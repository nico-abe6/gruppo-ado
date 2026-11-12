/*
 * spazio_personale.js
 *
 * Gestione dello spazio personale cifrato (vista #spazio di index.html):
 * apertura, creazione, modifica degli appunti, salvataggio, chiusura.
 * Gli appunti sono cifrati sul dispositivo (vedi cifratura_spazio_personale.js);
 * chiavi e testo in chiaro esistono solo in memoria finche' lo spazio e' aperto.
 *
 * Dipende da: UtilitaComuni, CifraturaSpazioPersonale.
 * Espone: SpazioPersonale.avviaSpazioPersonale(clientDatabase)
 */
(function inizializzaSpazioPersonale(ambitoGlobale) {
    "use strict";

    const utilita = ambitoGlobale.UtilitaComuni;
    const cifratura = ambitoGlobale.CifraturaSpazioPersonale;
    const configurazione = utilita.configurazione;
    const testo = utilita.ottieniTestoInterfaccia;

    const ESPRESSIONE_NOME_SPAZIO = /^[a-z0-9_-]{3,40}$/;
    const VERSIONE_FORMATO_SPAZIO = 1;

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
        spazioAperto = {
            nomeSpazio: nomeSpazio,
            chiaveCifratura: chiavi.chiaveCifratura,
            chiaveAccesso: chiavi.chiaveAccesso,
            appunti: appunti,
            modificheNonSalvate: false
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
            blocco.append(intestazione, campo);
            elementi.elencoAppunti.append(blocco);
        });
    }

    /* aggiungiNuovoAppunto: inserisce un appunto vuoto in cima e lo mette a fuoco. */
    function aggiungiNuovoAppunto() {
        spazioAperto.appunti.unshift({
            id: (window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now())),
            creatoIl: new Date().toISOString(),
            testo: ""
        });
        segnaModificheNonSalvate();
        disegnaAppunti();
        const primoCampo = elementi.elencoAppunti.querySelector("textarea");
        if (primoCampo) { primoCampo.focus(); }
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
            elencoAppunti: document.getElementById("elenco-appunti")
        };

        elementi.moduloAccessoSpazio.addEventListener("submit", apriSpazioEsistente);
        elementi.pulsanteCreaSpazio.addEventListener("click", creaNuovoSpazio);
        elementi.pulsanteNuovoAppunto.addEventListener("click", aggiungiNuovoAppunto);
        elementi.pulsanteSalvaSpazio.addEventListener("click", salvaSpazioPersonale);
        elementi.pulsanteEsciSpazio.addEventListener("click", chiudiSpazioPersonale);
        ambitoGlobale.addEventListener("beforeunload", avvisaSeModificheNonSalvate);

        if (!cifratura.eCifraturaSupportata()) {
            utilita.mostraMessaggioDiStato(elementi.statoAccessoSpazio, "browserNonSupportato", "errore");
            elementi.pulsanteApriSpazio.disabled = true;
        }
    }

    ambitoGlobale.SpazioPersonale = { avviaSpazioPersonale: avviaSpazioPersonale };
})(window);
