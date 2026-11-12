/*
 * utilita_comuni.js
 *
 * Funzioni condivise dalla bacheca (index.html) e dall'area educatori
 * (amministrazione.html):
 *   - lettura dei testi nella lingua configurata;
 *   - riempimento automatico degli elementi HTML con attributo data-testo;
 *   - formattazione delle date nella lingua del dispositivo;
 *   - creazione del client Supabase dalla configurazione;
 *   - logo (con segnaposto se il file manca) e icona della pagina.
 *
 * Richiede che siano gia' caricati config/configurazione.js,
 * config/testi_interfaccia.js e la libreria supabase-js.
 */
(function inizializzaUtilitaComuni(ambitoGlobale) {
    "use strict";

    const configurazione = ambitoGlobale.CONFIGURAZIONE_BACHECA;
    const testiDisponibili = ambitoGlobale.TESTI_INTERFACCIA;

    /*
     * ottieniTestoInterfaccia(chiave, sostituzioni)
     * Restituisce il testo per la chiave indicata nella lingua configurata.
     * Le sostituzioni { nome: valore } rimpiazzano i segnaposto {nome}.
     * Se la chiave manca, restituisce la chiave stessa per renderla visibile.
     */
    function ottieniTestoInterfaccia(chiave, sostituzioni) {
        const testiLingua = testiDisponibili[configurazione.linguaInterfaccia] || {};
        let testo = Object.prototype.hasOwnProperty.call(testiLingua, chiave) ? testiLingua[chiave] : chiave;
        if (sostituzioni) {
            Object.keys(sostituzioni).forEach(function sostituisciSegnaposto(nome) {
                testo = testo.split("{" + nome + "}").join(String(sostituzioni[nome]));
            });
        }
        return testo;
    }

    /*
     * applicaTestiInterfacciaAllaPagina(radice)
     * Riempie ogni elemento con data-testo="chiave" (testo visibile) e
     * data-testo-segnaposto="chiave" (placeholder dei campi).
     */
    function applicaTestiInterfacciaAllaPagina(radice) {
        const contenitore = radice || document;
        contenitore.querySelectorAll("[data-testo]").forEach(function impostaTesto(elemento) {
            elemento.textContent = ottieniTestoInterfaccia(elemento.dataset.testo);
        });
        contenitore.querySelectorAll("[data-testo-segnaposto]").forEach(function impostaSegnaposto(elemento) {
            elemento.placeholder = ottieniTestoInterfaccia(elemento.dataset.testoSegnaposto);
        });
        document.documentElement.lang = configurazione.linguaInterfaccia;
    }

    /*
     * formattaDataOraLocale(valoreData, soloOra)
     * Formatta una data con le convenzioni della lingua del dispositivo.
     */
    function formattaDataOraLocale(valoreData, soloOra) {
        const data = valoreData instanceof Date ? valoreData : new Date(valoreData);
        const opzioni = soloOra ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" };
        return new Intl.DateTimeFormat(undefined, opzioni).format(data);
    }

    /*
     * creaClientSupabaseDaConfigurazione()
     * Crea il client per parlare con il database usando la configurazione.
     */
    function creaClientSupabaseDaConfigurazione() {
        return ambitoGlobale.supabase.createClient(
            configurazione.indirizzoSupabase,
            configurazione.chiavePubblicaSupabase
        );
    }

    /*
     * mostraMessaggioDiStato(elemento, chiaveTesto, tipo, sostituzioni)
     * Scrive un messaggio in un'area di stato. tipo: "info", "errore", "ok".
     * Passando chiaveTesto vuota il messaggio viene nascosto.
     */
    function mostraMessaggioDiStato(elemento, chiaveTesto, tipo, sostituzioni) {
        if (!elemento) { return; }
        if (!chiaveTesto) {
            elemento.textContent = "";
            elemento.hidden = true;
            return;
        }
        elemento.textContent = ottieniTestoInterfaccia(chiaveTesto, sostituzioni);
        elemento.dataset.tipo = tipo || "info";
        elemento.hidden = false;
    }

    /*
     * creaElementoConTesto(nomeTag, classe, testo)
     * Crea un elemento HTML e ne imposta il testo in modo sicuro
     * (textContent: nessun HTML inserito dagli utenti viene interpretato).
     */
    function creaElementoConTesto(nomeTag, classe, testo) {
        const elemento = document.createElement(nomeTag);
        if (classe) { elemento.className = classe; }
        if (testo !== undefined && testo !== null) { elemento.textContent = testo; }
        return elemento;
    }

    /*
     * eIndirizzoWebValido(indirizzo)
     * Accetta solo link http/https, per evitare link "javascript:" e simili.
     */
    function eIndirizzoWebValido(indirizzo) {
        return typeof indirizzo === "string" && /^https?:\/\/\S+$/i.test(indirizzo.trim());
    }

    /*
     * applicaLogoAllaPagina()
     * Mostra il logo in ogni <img data-logo> e lo usa come icona della pagina.
     * Se il file del logo non esiste, usa il segnaposto.
     * Restituisce una Promise con il percorso effettivamente usato.
     */
    function applicaLogoAllaPagina() {
        const immaginiLogo = document.querySelectorAll("img[data-logo]");
        const iconaPagina = document.createElement("link");
        iconaPagina.rel = "icon";
        document.head.append(iconaPagina);

        function usaPercorso(percorso) {
            immaginiLogo.forEach(function impostaSorgente(immagine) {
                immagine.src = percorso;
                immagine.alt = configurazione.nomeGruppo + " \u2013 " + ottieniTestoInterfaccia("logoAlternativo");
            });
            iconaPagina.href = percorso;
        }

        return new Promise(function verificaLogo(risolvi) {
            const verifica = new Image();
            verifica.onload = function logoTrovato() {
                usaPercorso(configurazione.percorsoLogo);
                risolvi(configurazione.percorsoLogo);
            };
            verifica.onerror = function logoMancante() {
                usaPercorso(configurazione.percorsoLogoSegnaposto);
                risolvi(configurazione.percorsoLogoSegnaposto);
            };
            verifica.src = configurazione.percorsoLogo;
        });
    }

    ambitoGlobale.UtilitaComuni = {
        applicaLogoAllaPagina: applicaLogoAllaPagina,
        configurazione: configurazione,
        ottieniTestoInterfaccia: ottieniTestoInterfaccia,
        applicaTestiInterfacciaAllaPagina: applicaTestiInterfacciaAllaPagina,
        formattaDataOraLocale: formattaDataOraLocale,
        creaClientSupabaseDaConfigurazione: creaClientSupabaseDaConfigurazione,
        mostraMessaggioDiStato: mostraMessaggioDiStato,
        creaElementoConTesto: creaElementoConTesto,
        eIndirizzoWebValido: eIndirizzoWebValido
    };
})(window);
