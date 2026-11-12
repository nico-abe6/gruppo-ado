/*
 * cifratura_spazio_personale.js
 *
 * Cifratura degli appunti personali, eseguita interamente sul dispositivo
 * con la Web Crypto API del browser.
 *
 * Schema:
 *   password + sale casuale --PBKDF2-SHA256 (N iterazioni)--> 512 bit
 *     primi 256 bit   -> chiave AES-GCM per cifrare/decifrare gli appunti
 *     ultimi 256 bit  -> "chiave di accesso", inviata al database che ne
 *                        conserva solo l'hash bcrypt (serve a impedire che
 *                        altri sovrascrivano o scarichino lo spazio)
 *
 * Le due meta' sono indipendenti: conoscere la chiave di accesso non
 * permette di ricavare la chiave di cifratura. La password non lascia
 * mai il dispositivo.
 *
 * Le immagini sono cifrate con la stessa chiave AES-GCM, ognuna con un
 * proprio vettore iniziale casuale (cifraDatiBinari / decifraDatiBinari).
 *
 * I parametri pubblici sono salvati come testo "pbkdf2-sha256:<iterazioni>:<sale base64>".
 */
(function inizializzaCifraturaSpazioPersonale(ambitoGlobale) {
    "use strict";

    const cryptoBrowser = ambitoGlobale.crypto;
    const LUNGHEZZA_SALE_BYTE = 16;
    const LUNGHEZZA_VETTORE_INIZIALE_BYTE = 12;
    const PREFISSO_PARAMETRI = "pbkdf2-sha256";

    /* convertiByteInBase64 / convertiBase64InByte: conversioni per il trasporto come testo. */
    function convertiByteInBase64(byte) {
        const DIMENSIONE_BLOCCO = 0x8000; // a blocchi: veloce anche per le immagini
        let binario = "";
        for (let indice = 0; indice < byte.length; indice += DIMENSIONE_BLOCCO) {
            binario += String.fromCharCode.apply(null, byte.subarray(indice, indice + DIMENSIONE_BLOCCO));
        }
        return ambitoGlobale.btoa(binario);
    }

    function convertiBase64InByte(testoBase64) {
        const binario = ambitoGlobale.atob(testoBase64);
        const byte = new Uint8Array(binario.length);
        for (let indice = 0; indice < binario.length; indice += 1) {
            byte[indice] = binario.charCodeAt(indice);
        }
        return byte;
    }

    /* convertiByteInEsadecimale: usato per la chiave di accesso inviata al database. */
    function convertiByteInEsadecimale(byte) {
        return Array.from(byte, function cifraEsadecimale(valore) {
            return valore.toString(16).padStart(2, "0");
        }).join("");
    }

    /* eCifraturaSupportata: verifica che il browser offra la Web Crypto API. */
    function eCifraturaSupportata() {
        return Boolean(cryptoBrowser && cryptoBrowser.subtle && ambitoGlobale.TextEncoder);
    }

    /*
     * generaParametriDerivazione(iterazioni)
     * Crea i parametri pubblici per un nuovo spazio (sale casuale).
     */
    function generaParametriDerivazione(iterazioni) {
        const sale = cryptoBrowser.getRandomValues(new Uint8Array(LUNGHEZZA_SALE_BYTE));
        return [PREFISSO_PARAMETRI, String(iterazioni), convertiByteInBase64(sale)].join(":");
    }

    /* leggiParametriDerivazione: interpreta il testo dei parametri salvato nel database. */
    function leggiParametriDerivazione(testoParametri) {
        const parti = String(testoParametri).split(":");
        const iterazioni = Number(parti[1]);
        if (parti.length !== 3 || parti[0] !== PREFISSO_PARAMETRI || !Number.isInteger(iterazioni) || iterazioni < 1) {
            throw new Error("parametri_derivazione_non_validi");
        }
        return { iterazioni: iterazioni, sale: convertiBase64InByte(parti[2]) };
    }

    /*
     * derivaChiaviDaPassword(password, testoParametri)
     * Restituisce { chiaveCifratura (CryptoKey), chiaveAccesso (testo esadecimale) }.
     * E' volutamente lenta (molte iterazioni) per rendere costosi i tentativi.
     */
    async function derivaChiaviDaPassword(password, testoParametri) {
        const parametri = leggiParametriDerivazione(testoParametri);
        const materialeChiave = await cryptoBrowser.subtle.importKey(
            "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
        );
        const bitDerivati = new Uint8Array(await cryptoBrowser.subtle.deriveBits(
            { name: "PBKDF2", hash: "SHA-256", salt: parametri.sale, iterations: parametri.iterazioni },
            materialeChiave,
            512
        ));
        const chiaveCifratura = await cryptoBrowser.subtle.importKey(
            "raw", bitDerivati.slice(0, 32), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
        );
        const chiaveAccesso = convertiByteInEsadecimale(bitDerivati.slice(32, 64));
        bitDerivati.fill(0);
        return { chiaveCifratura: chiaveCifratura, chiaveAccesso: chiaveAccesso };
    }

    /*
     * cifraContenutoSpazio(chiaveCifratura, contenuto)
     * Cifra un oggetto JavaScript (serializzato in JSON) con AES-GCM.
     * Restituisce { vettoreIniziale, testoCifrato } in base64.
     */
    async function cifraContenutoSpazio(chiaveCifratura, contenuto) {
        const vettoreIniziale = cryptoBrowser.getRandomValues(new Uint8Array(LUNGHEZZA_VETTORE_INIZIALE_BYTE));
        const datiInChiaro = new TextEncoder().encode(JSON.stringify(contenuto));
        const datiCifrati = new Uint8Array(await cryptoBrowser.subtle.encrypt(
            { name: "AES-GCM", iv: vettoreIniziale }, chiaveCifratura, datiInChiaro
        ));
        return {
            vettoreIniziale: convertiByteInBase64(vettoreIniziale),
            testoCifrato: convertiByteInBase64(datiCifrati)
        };
    }

    /*
     * decifraContenutoSpazio(chiaveCifratura, vettoreInizialeBase64, testoCifratoBase64)
     * Operazione inversa di cifraContenutoSpazio. Fallisce se la chiave e' sbagliata
     * o se i dati sono stati alterati (AES-GCM verifica l'integrita').
     */
    async function decifraContenutoSpazio(chiaveCifratura, vettoreInizialeBase64, testoCifratoBase64) {
        const datiInChiaro = await cryptoBrowser.subtle.decrypt(
            { name: "AES-GCM", iv: convertiBase64InByte(vettoreInizialeBase64) },
            chiaveCifratura,
            convertiBase64InByte(testoCifratoBase64)
        );
        return JSON.parse(new TextDecoder().decode(datiInChiaro));
    }

    /*
     * cifraDatiBinari(chiaveCifratura, byte)
     * Cifra dati binari (es. una foto JPEG) con AES-GCM.
     * Restituisce { vettoreIniziale, testoCifrato } in base64.
     */
    async function cifraDatiBinari(chiaveCifratura, byte) {
        const vettoreIniziale = cryptoBrowser.getRandomValues(new Uint8Array(LUNGHEZZA_VETTORE_INIZIALE_BYTE));
        const datiCifrati = new Uint8Array(await cryptoBrowser.subtle.encrypt(
            { name: "AES-GCM", iv: vettoreIniziale }, chiaveCifratura, byte
        ));
        return {
            vettoreIniziale: convertiByteInBase64(vettoreIniziale),
            testoCifrato: convertiByteInBase64(datiCifrati)
        };
    }

    /* decifraDatiBinari: operazione inversa di cifraDatiBinari; restituisce un Uint8Array. */
    async function decifraDatiBinari(chiaveCifratura, vettoreInizialeBase64, testoCifratoBase64) {
        return new Uint8Array(await cryptoBrowser.subtle.decrypt(
            { name: "AES-GCM", iv: convertiBase64InByte(vettoreInizialeBase64) },
            chiaveCifratura,
            convertiBase64InByte(testoCifratoBase64)
        ));
    }

    ambitoGlobale.CifraturaSpazioPersonale = {
        cifraDatiBinari: cifraDatiBinari,
        decifraDatiBinari: decifraDatiBinari,
        eCifraturaSupportata: eCifraturaSupportata,
        generaParametriDerivazione: generaParametriDerivazione,
        derivaChiaviDaPassword: derivaChiaviDaPassword,
        cifraContenutoSpazio: cifraContenutoSpazio,
        decifraContenutoSpazio: decifraContenutoSpazio
    };
})(globalThis);
