/*
 * spazio_personale.js
 *
 * Gestione dello spazio personale cifrato (vista #spazio di index.html):
 * apertura, creazione, modifica degli appunti, foto negli appunti,
 * salvataggio, chiusura.
 * Appunti e foto sono cifrati sul dispositivo (vedi cifratura_spazio_personale.js);
 * chiavi, testo e foto in chiaro esistono solo in memoria finche' lo spazio e' aperto.
 *
 * Foto: vengono ridotte, cifrate e caricate subito (tabella
 * immagini_spazi_personali); l'elenco delle foto di ogni appunto sta negli
 * appunti cifrati. Al salvataggio il database elimina le foto che non
 * compaiono piu' in nessun appunto (tolte o caricate e mai salvate).
 *
 * Dipende da: UtilitaComuni, CifraturaSpazioPersonale, ElaborazioneFoto.
 * Espone: SpazioPersonale.avviaSpazioPersonale(clientDatabase)
 */
(function inizializzaSpazioPersonale(ambitoGlobale) {
    "use strict";

    const utilita = ambitoGlobale.UtilitaComuni;
    const cifratura = ambitoGlobale.CifraturaSpazioPersonale;
    const configurazione = utilita.configurazione;
    const testo = utilita.ottieniTestoInterfaccia;

    const ESPRESSIONE_NOME_SPAZIO = /^[a-z0-9_-]{3,40}$/;
    // Versione 2: ogni appunto ha anche "immagini" (elenco di id). Gli spazi
    // in versione 1 si leggono ugualmente (appunti senza immagini).
    const VERSIONE_FORMATO_SPAZIO = 2;

    let clientDatabase = null;
    let elementi = null;

    /* Stato dello spazio aperto: esiste solo in memoria, sparisce chiudendo la pagina. */
    let spazioAperto = null;

    /* leggiCredenzialiSpazio: legge e controlla nome e password dal modulo. */
    function leggiCredenzialiSpazio() {
        const nomeSpazio = elementi.campoNomeSpazio.value.trim().toLowerCase();
        const password = elementi.campoPasswordSpazio.value;
        if (!ESPRESSIONE_NOME_SPAZIO.test(nomeSpazio)) {
            utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "nomeNonValido", "errore");
            return null;
        }
        if (password.length < configurazione.lunghezzaMinimaPassword) {
            utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "passwordCorta", "errore",
                { minimo: configurazione.lunghezzaMinimaPassword });
            return null;
        }
        return { nomeSpazio: nomeSpazio, password: password };
    }

    /* impostaAttesaAccesso: blocca i pulsanti durante il calcolo delle chiavi. */
    function impostaAttesaAccesso(inAttesa) {
        elementi.pulsanteApriSpazio.disabled = inAttesa;
        elementi.pulsanteCreaSpazio.disabled = inAttesa;
        if (inAttesa) {
            utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "attendereCalcolo", "info");
        }
    }

    /* apriSpazioEsistente: verifica nome e password, scarica e decifra gli appunti. */
    async function apriSpazioEsistente(evento) {
        evento.preventDefault();
        elementi.pulsanteCreaSpazio.hidden = true;
        const credenziali = leggiCredenzialiSpazio();
        if (!credenziali) { return; }

        impostaAttesaAccesso(true);
        try {
            const rispostaParametri = await clientDatabase.rpc("ottieni_parametri_spazio_personale",
                { p_nome_spazio: credenziali.nomeSpazio });
            if (rispostaParametri.error) { throw rispostaParametri.error; }
            if (!rispostaParametri.data) {
                utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "spazioInesistente", "info");
                elementi.pulsanteCreaSpazio.hidden = false;
                return;
            }

            const chiavi = await cifratura.derivaChiaviDaPassword(credenziali.password, rispostaParametri.data);
            const rispostaLettura = await clientDatabase.rpc("leggi_spazio_personale",
                { p_nome_spazio: credenziali.nomeSpazio, p_chiave_accesso: chiavi.chiaveAccesso });
            if (rispostaLettura.error) { throw rispostaLettura.error; }
            if (!rispostaLettura.data || rispostaLettura.data.length === 0) {
                utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "nomeOPasswordErrati", "errore");
                return;
            }

            const riga = rispostaLettura.data[0];
            const contenuto = await cifratura.decifraContenutoSpazio(chiavi.chiaveCifratura, riga.vettore_iniziale, riga.testo_cifrato);
            mostraSpazioAperto(credenziali.nomeSpazio, chiavi, contenuto.appunti || [], "");
        } catch (errore) {
            console.error("Apertura spazio non riuscita:", errore);
            utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "erroreGenerico", "errore");
        } finally {
            impostaAttesaAccesso(false);
            if (spazioAperto) { utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, ""); }
        }
    }

    /* creaNuovoSpazio: crea uno spazio vuoto con il nome e la password inseriti. */
    async function creaNuovoSpazio() {
        const credenziali = leggiCredenzialiSpazio();
        if (!credenziali) { return; }

        impostaAttesaAccesso(true);
        try {
            const parametri = cifratura.generaParametriDerivazione(configurazione.iterazioniDerivazionePassword);
            const chiavi = await cifratura.derivaChiaviDaPassword(credenziali.password, parametri);
            const contenutoIniziale = await cifratura.cifraContenutoSpazio(chiavi.chiaveCifratura,
                { versione: VERSIONE_FORMATO_SPAZIO, appunti: [] });
            const risposta = await clientDatabase.rpc("crea_spazio_personale", {
                p_nome_spazio: credenziali.nomeSpazio,
                p_parametri_derivazione: parametri,
                p_chiave_accesso: chiavi.chiaveAccesso,
                p_vettore_iniziale: contenutoIniziale.vettoreIniziale,
                p_testo_cifrato: contenutoIniziale.testoCifrato
            });
            if (risposta.error) { throw risposta.error; }
            if (risposta.data !== true) {
                utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "nomeGiaUsato", "errore");
                return;
            }
            elementi.pulsanteCreaSpazio.hidden = true;
            mostraSpazioAperto(credenziali.nomeSpazio, chiavi, [], "avvisoPassword");
        } catch (errore) {
            console.error("Creazione spazio non riuscita:", errore);
            utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "erroreGenerico", "errore");
        } finally {
            impostaAttesaAccesso(false);
            if (spazioAperto) { utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, ""); }
        }
    }

    /* mostraSpazioAperto: passa dal modulo di accesso al quaderno. */
    function mostraSpazioAperto(nomeSpazio, chiavi, appunti, chiaveMessaggioIniziale) {
        appunti.forEach(function completaAppunto(appunto) {
            if (!Array.isArray(appunto.immagini)) { appunto.immagini = []; }
        });
        spazioAperto = {
            nomeSpazio: nomeSpazio,
            chiaveCifratura: chiavi.chiaveCifratura,
            chiaveAccesso: chiavi.chiaveAccesso,
            appunti: appunti,
            modificheNonSalvate: false,
            // id immagine -> indirizzo temporaneo (blob:) della foto decifrata
            indirizziImmagini: new Map(),
            // id immagine -> Promise del download in corso
            caricamentiImmagini: new Map(),
            appuntoPerNuovaImmagine: null
        };
        elementi.campoPasswordSpazio.value = "";
        elementi.moduloAccessoSpazio.hidden = true;
        elementi.quadernoSpazio.hidden = false;
        elementi.titoloQuaderno.textContent = testo("titoloSpazioAperto", { nome: nomeSpazio });
        utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, chiaveMessaggioIniziale, "info");
        disegnaAppunti();
    }

    /* disegnaAppunti: mostra gli appunti, dal piu' recente. */
    function disegnaAppunti() {
        elementi.elencoAppunti.replaceChildren();
        if (spazioAperto.appunti.length === 0) {
            elementi.elencoAppunti.append(utilita.creaElementoConTesto("p", "testo-vuoto", testo("nessunAppunto")));
            return;
        }
        spazioAperto.appunti.forEach(function aggiungiAppunto(appunto) {
            const blocco = utilita.creaElementoConTesto("div", "appunto");
            const intestazione = utilita.creaElementoConTesto("div", "intestazione-appunto");
            const pulsanteElimina = utilita.creaElementoConTesto("button", "pulsante-pericolo", testo("pulsanteEliminaAppunto"));
            pulsanteElimina.type = "button";
            pulsanteElimina.addEventListener("click", function eliminaAppunto() {
                if (!window.confirm(testo("confermaEliminaAppunto"))) { return; }
                spazioAperto.appunti = spazioAperto.appunti.filter(function tieniAltri(altro) { return altro.id !== appunto.id; });
                segnaModificheNonSalvate();
                disegnaAppunti();
            });
            const data = utilita.formattaDataOraLocale(appunto.creatoIl);
            intestazione.append(utilita.creaElementoConTesto("time", "", data), pulsanteElimina);

            const campo = document.createElement("textarea");
            campo.value = appunto.testo;
            campo.setAttribute("aria-label", data);
            campo.addEventListener("input", function aggiornaTestoAppunto() {
                appunto.testo = campo.value;
                segnaModificheNonSalvate();
            });
            blocco.append(intestazione, campo, creaGalleriaAppunto(appunto));
            elementi.elencoAppunti.append(blocco);
        });
    }

    /* aggiungiNuovoAppunto: inserisce un appunto vuoto in cima e lo mette a fuoco. */
    function aggiungiNuovoAppunto() {
        spazioAperto.appunti.unshift({
            id: generaIdentificativo(),
            creatoIl: new Date().toISOString(),
            testo: "",
            immagini: []
        });
        segnaModificheNonSalvate();
        disegnaAppunti();
        const primoCampo = elementi.elencoAppunti.querySelector("textarea");
        if (primoCampo) { primoCampo.focus(); }
    }

    /* generaIdentificativo: UUID casuale (formato accettato dal database per le immagini). */
    function generaIdentificativo() {
        if (window.crypto.randomUUID) { return window.crypto.randomUUID(); }
        const byte = window.crypto.getRandomValues(new Uint8Array(16));
        byte[6] = (byte[6] & 0x0f) | 0x40;
        byte[8] = (byte[8] & 0x3f) | 0x80;
        const esadecimale = Array.from(byte, function cifra(valore) { return valore.toString(16).padStart(2, "0"); }).join("");
        return [esadecimale.slice(0, 8), esadecimale.slice(8, 12), esadecimale.slice(12, 16),
            esadecimale.slice(16, 20), esadecimale.slice(20)].join("-");
    }

    /* contaImmaginiNegliAppunti: numero di foto presenti negli appunti aperti. */
    function contaImmaginiNegliAppunti() {
        return spazioAperto.appunti.reduce(function somma(totale, appunto) { return totale + appunto.immagini.length; }, 0);
    }

    /*
     * creaGalleriaAppunto(appunto)
     * Miniature delle foto dell'appunto (si aprono in grande toccandole),
     * ognuna con il pulsante per toglierla, e il pulsante "Aggiungi foto".
     */
    function creaGalleriaAppunto(appunto) {
        const galleria = utilita.creaElementoConTesto("div", "immagini-appunto");
        appunto.immagini.forEach(function aggiungiMiniatura(idImmagine) {
            const contenitore = utilita.creaElementoConTesto("div", "contenitore-miniatura-appunto");
            const pulsanteApri = utilita.creaElementoConTesto("button", "miniatura-appunto");
            pulsanteApri.type = "button";
            pulsanteApri.setAttribute("aria-label", testo("immagineAppunto"));
            const immagine = document.createElement("img");
            immagine.alt = "";
            immagine.dataset.idImmagine = idImmagine;
            pulsanteApri.append(immagine);
            pulsanteApri.addEventListener("click", function apri() { apriImmagineInGrande(idImmagine); });

            const pulsanteTogli = utilita.creaElementoConTesto("button", "pulsante-togli-immagine", "\u00d7");
            pulsanteTogli.type = "button";
            pulsanteTogli.setAttribute("aria-label", testo("pulsanteTogliImmagine"));
            pulsanteTogli.addEventListener("click", function togli() {
                if (!window.confirm(testo("confermaTogliImmagine"))) { return; }
                appunto.immagini = appunto.immagini.filter(function tieniAltre(altra) { return altra !== idImmagine; });
                segnaModificheNonSalvate();
                disegnaAppunti();
            });
            contenitore.append(pulsanteApri, pulsanteTogli);
            galleria.append(contenitore);
            mostraImmagineQuandoPronta(idImmagine, immagine);
        });

        const pulsanteAggiungi = utilita.creaElementoConTesto("button", "pulsante-secondario pulsante-aggiungi-immagine", testo("pulsanteAggiungiImmagine"));
        pulsanteAggiungi.type = "button";
        pulsanteAggiungi.addEventListener("click", function scegliFoto() {
            spazioAperto.appuntoPerNuovaImmagine = appunto;
            elementi.campoImmagineSpazio.value = "";
            elementi.campoImmagineSpazio.click();
        });
        galleria.append(pulsanteAggiungi);
        return galleria;
    }

    /*
     * ottieniIndirizzoImmagine(idImmagine)
     * Scarica e decifra una foto (una sola volta) e restituisce un indirizzo
     * blob: utilizzabile da <img>. Restituisce null se la foto non c'e'.
     */
    function ottieniIndirizzoImmagine(idImmagine) {
        const spazio = spazioAperto;
        if (spazio.indirizziImmagini.has(idImmagine)) { return Promise.resolve(spazio.indirizziImmagini.get(idImmagine)); }
        if (spazio.caricamentiImmagini.has(idImmagine)) { return spazio.caricamentiImmagini.get(idImmagine); }
        const caricamento = (async function scaricaEDecifra() {
            const risposta = await clientDatabase.rpc("leggi_immagine_spazio_personale", {
                p_nome_spazio: spazio.nomeSpazio,
                p_chiave_accesso: spazio.chiaveAccesso,
                p_id_immagine: idImmagine
            });
            if (risposta.error) { throw risposta.error; }
            if (!risposta.data || risposta.data.length === 0) { return null; }
            const byte = await cifratura.decifraDatiBinari(spazio.chiaveCifratura,
                risposta.data[0].vettore_iniziale, risposta.data[0].dati_cifrati);
            const indirizzo = URL.createObjectURL(new Blob([byte], { type: "image/jpeg" }));
            if (spazioAperto !== spazio) { URL.revokeObjectURL(indirizzo); return null; }
            spazio.indirizziImmagini.set(idImmagine, indirizzo);
            return indirizzo;
        })();
        spazio.caricamentiImmagini.set(idImmagine, caricamento);
        caricamento.catch(function dimenticaErrore() { spazio.caricamentiImmagini.delete(idImmagine); });
        return caricamento;
    }

    /* mostraImmagineQuandoPronta: imposta la miniatura appena la foto e' decifrata. */
    function mostraImmagineQuandoPronta(idImmagine, immagine) {
        ottieniIndirizzoImmagine(idImmagine).then(function mostra(indirizzo) {
            if (indirizzo) {
                immagine.src = indirizzo;
            } else {
                immagine.replaceWith(utilita.creaElementoConTesto("span", "immagine-mancante", testo("immagineNonDisponibile")));
            }
        }).catch(function erroreImmagine(errore) {
            console.error("Foto non caricata:", errore);
            immagine.replaceWith(utilita.creaElementoConTesto("span", "immagine-mancante", testo("immagineNonDisponibile")));
        });
    }

    /* apriImmagineInGrande: mostra la foto a tutto schermo nella finestra dedicata. */
    function apriImmagineInGrande(idImmagine) {
        const indirizzo = spazioAperto.indirizziImmagini.get(idImmagine);
        if (!indirizzo) { return; }
        elementi.immagineGrandeSpazio.src = indirizzo;
        elementi.immagineGrandeSpazio.alt = testo("immagineAppunto");
        if (elementi.finestraImmagineSpazio.showModal) {
            elementi.finestraImmagineSpazio.showModal();
        } else {
            elementi.finestraImmagineSpazio.setAttribute("open", "");
        }
    }

    /* chiudiImmagineInGrande: chiude la finestra della foto. */
    function chiudiImmagineInGrande() {
        if (elementi.finestraImmagineSpazio.close) {
            elementi.finestraImmagineSpazio.close();
        } else {
            elementi.finestraImmagineSpazio.removeAttribute("open");
        }
        elementi.immagineGrandeSpazio.removeAttribute("src");
    }

    /*
     * aggiungiImmagineScelta()
     * Riduce la foto scelta, la cifra, la carica e la aggiunge all'appunto.
     * La foto resta nell'appunto solo se poi si preme "Salva".
     */
    async function aggiungiImmagineScelta() {
        const file = elementi.campoImmagineSpazio.files && elementi.campoImmagineSpazio.files[0];
        const appunto = spazioAperto && spazioAperto.appuntoPerNuovaImmagine;
        if (!file || !appunto) { return; }
        const spazio = spazioAperto;
        const massimo = configurazione.numeroMassimoImmaginiSpazio;
        if (contaImmaginiNegliAppunti() >= massimo) {
            utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "limiteImmaginiRaggiunto", "errore", { massimo: massimo });
            return;
        }

        impostaAttesaImmagine(true);
        utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "caricamentoImmagine", "info");
        try {
            const fotoJpeg = await window.ElaborazioneFoto.preparaFotoPerInvio(file, {
                latoMassimoFotoPixel: configurazione.latoMassimoImmagineSpazioPixel,
                qualitaFotoJpeg: configurazione.qualitaImmagineSpazioJpeg,
                dimensioneMassimaFileFotoByte: configurazione.dimensioneMassimaImmagineSpazioByte
            });
            const byte = new Uint8Array(await fotoJpeg.arrayBuffer());
            const cifrato = await cifratura.cifraDatiBinari(spazio.chiaveCifratura, byte);
            const idImmagine = generaIdentificativo();
            const risposta = await clientDatabase.rpc("aggiungi_immagine_spazio_personale", {
                p_nome_spazio: spazio.nomeSpazio,
                p_chiave_accesso: spazio.chiaveAccesso,
                p_id_immagine: idImmagine,
                p_vettore_iniziale: cifrato.vettoreIniziale,
                p_dati_cifrati: cifrato.testoCifrato
            });
            if (risposta.error) { throw risposta.error; }
            if (risposta.data !== true) { throw new Error("caricamento_rifiutato"); }
            if (spazioAperto !== spazio) { return; }

            spazio.indirizziImmagini.set(idImmagine, URL.createObjectURL(fotoJpeg));
            appunto.immagini.push(idImmagine);
            segnaModificheNonSalvate();
            disegnaAppunti();
            utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "immagineAggiunta", "info");
        } catch (errore) {
            console.error("Foto non aggiunta:", errore);
            const messaggio = String((errore && errore.message) || "");
            if (messaggio.indexOf("limite_immagini_raggiunto") !== -1) {
                utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "limiteImmaginiRaggiunto", "errore", { massimo: massimo });
            } else if (messaggio === "foto_non_leggibile") {
                utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "fotoNonLeggibile", "errore");
            } else if (messaggio === "foto_troppo_grande") {
                utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "fotoTroppoGrande", "errore");
            } else {
                utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "erroreGenerico", "errore");
            }
        } finally {
            impostaAttesaImmagine(false);
        }
    }

    /* impostaAttesaImmagine: blocca i pulsanti mentre una foto viene caricata. */
    function impostaAttesaImmagine(inAttesa) {
        elementi.pulsanteSalvaSpazio.disabled = inAttesa;
        elementi.pulsanteEsciSpazio.disabled = inAttesa;
        elementi.elencoAppunti.querySelectorAll(".pulsante-aggiungi-immagine").forEach(function blocca(pulsante) {
            pulsante.disabled = inAttesa;
        });
    }

    /* pulisciImmaginiNonUsate: dopo il salvataggio elimina dal database le foto non piu' negli appunti. */
    async function pulisciImmaginiNonUsate(spazio) {
        const idDaTenere = [];
        spazio.appunti.forEach(function raccogli(appunto) { idDaTenere.push.apply(idDaTenere, appunto.immagini); });
        const risposta = await clientDatabase.rpc("pulisci_immagini_spazio_personale", {
            p_nome_spazio: spazio.nomeSpazio,
            p_chiave_accesso: spazio.chiaveAccesso,
            p_id_da_tenere: idDaTenere
        });
        if (risposta.error) { console.warn("Pulizia delle foto non riuscita:", risposta.error); }
    }

    /* segnaModificheNonSalvate: ricorda che c'e' qualcosa da salvare. */
    function segnaModificheNonSalvate() {
        spazioAperto.modificheNonSalvate = true;
        utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "modificheNonSalvate", "info");
    }

    /* salvaSpazioPersonale: cifra gli appunti e li invia al database. */
    async function salvaSpazioPersonale() {
        elementi.pulsanteSalvaSpazio.disabled = true;
        try {
            const cifrato = await cifratura.cifraContenutoSpazio(spazioAperto.chiaveCifratura,
                { versione: VERSIONE_FORMATO_SPAZIO, appunti: spazioAperto.appunti });
            const risposta = await clientDatabase.rpc("salva_spazio_personale", {
                p_nome_spazio: spazioAperto.nomeSpazio,
                p_chiave_accesso: spazioAperto.chiaveAccesso,
                p_vettore_iniziale: cifrato.vettoreIniziale,
                p_testo_cifrato: cifrato.testoCifrato
            });
            if (risposta.error || !risposta.data) { throw risposta.error || new Error("salvataggio_rifiutato"); }
            spazioAperto.modificheNonSalvate = false;
            utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "salvato", "ok",
                { ora: utilita.formattaDataOraLocale(risposta.data, true) });
            await pulisciImmaginiNonUsate(spazioAperto);
        } catch (errore) {
            console.error("Salvataggio non riuscito:", errore);
            utilita.mostraMessaggioDiStato(elementi.statoSpazioPersonale, "erroreGenerico", "errore");
        } finally {
            elementi.pulsanteSalvaSpazio.disabled = false;
        }
    }

    /* chiudiSpazioPersonale: dimentica chiavi e appunti e torna al modulo di accesso. */
    function chiudiSpazioPersonale() {
        if (spazioAperto && spazioAperto.modificheNonSalvate && !window.confirm(testo("modificheNonSalvate"))) { return; }
        if (spazioAperto) {
            spazioAperto.indirizziImmagini.forEach(function libera(indirizzo) { URL.revokeObjectURL(indirizzo); });
        }
        spazioAperto = null;
        elementi.elencoAppunti.replaceChildren();
        elementi.quadernoSpazio.hidden = true;
        elementi.moduloAccessoSpazio.hidden = false;
        utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "");
    }

    /* avvisaSeModificheNonSalvate: chiede conferma se si chiude la pagina senza salvare. */
    function avvisaSeModificheNonSalvate(evento) {
        if (spazioAperto && spazioAperto.modificheNonSalvate) {
            evento.preventDefault();
            evento.returnValue = "";
        }
    }

    /*
     * avviaSpazioPersonale(client)
     * Collega gli elementi della vista #spazio e i relativi eventi.
     */
    function avviaSpazioPersonale(client) {
        clientDatabase = client;
        elementi = {
            moduloAccessoSpazio: document.getElementById("modulo-accesso-spazio"),
            campoNomeSpazio: document.getElementById("campo-nome-spazio"),
            campoPasswordSpazio: document.getElementById("campo-password-spazio"),
            pulsanteApriSpazio: document.getElementById("pulsante-apri-spazio"),
            pulsanteCreaSpazio: document.getElementById("pulsante-crea-spazio"),
            statoAccessoSpazio: document.getElementById("stato-accesso-spazio"),
            quadernoSpazio: document.getElementById("quaderno-spazio-personale"),
            titoloQuaderno: document.getElementById("titolo-quaderno"),
            pulsanteNuovoAppunto: document.getElementById("pulsante-nuovo-appunto"),
            pulsanteSalvaSpazio: document.getElementById("pulsante-salva-spazio"),
            pulsanteEsciSpazio: document.getElementById("pulsante-esci-spazio"),
            statoSpazioPersonale: document.getElementById("stato-spazio-personale"),
            elencoAppunti: document.getElementById("elenco-appunti"),
            campoImmagineSpazio: document.getElementById("campo-immagine-spazio"),
            finestraImmagineSpazio: document.getElementById("finestra-immagine-spazio"),
            immagineGrandeSpazio: document.getElementById("immagine-grande-spazio"),
            pulsanteChiudiImmagine: document.getElementById("pulsante-chiudi-immagine")
        };

        elementi.moduloAccessoSpazio.addEventListener("submit", apriSpazioEsistente);
        elementi.pulsanteCreaSpazio.addEventListener("click", creaNuovoSpazio);
        elementi.pulsanteNuovoAppunto.addEventListener("click", aggiungiNuovoAppunto);
        elementi.pulsanteSalvaSpazio.addEventListener("click", salvaSpazioPersonale);
        elementi.pulsanteEsciSpazio.addEventListener("click", chiudiSpazioPersonale);
        elementi.campoImmagineSpazio.addEventListener("change", aggiungiImmagineScelta);
        elementi.pulsanteChiudiImmagine.addEventListener("click", chiudiImmagineInGrande);
        elementi.finestraImmagineSpazio.addEventListener("click", function chiudiToccandoFuori(evento) {
            if (evento.target === elementi.finestraImmagineSpazio) { chiudiImmagineInGrande(); }
        });
        ambitoGlobale.addEventListener("beforeunload", avvisaSeModificheNonSalvate);

        if (!cifratura.eCifraturaSupportata()) {
            utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "browserNonSupportato", "errore");
            elementi.pulsanteApriSpazio.disabled = true;
        }
    }

    ambitoGlobale.SpazioPersonale = { avviaSpazioPersonale: avviaSpazioPersonale };
})(window);
