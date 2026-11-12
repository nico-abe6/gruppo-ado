/*
 * installazione_app.js
 *
 * Rende la pagina installabile come app sul telefono (PWA):
 *   - registra il service worker servizio_offline.js;
 *   - su Android/Chrome intercetta la proposta di installazione e la collega
 *     ai pulsanti con attributo data-installa-app (nascosti finche' non
 *     e' possibile installare);
 *   - mostra gli elementi con data-istruzioni-installazione (istruzioni per
 *     iPhone e per i browser senza pulsante), salvo che l'app sia gia'
 *     installata o che l'utente abbia premuto un pulsante data-nascondi-installazione.
 */
(function avviaInstallazioneApp() {
    "use strict";

    const CHIAVE_MEMORIA_NASCOSTO = "bacheca_installazione_nascosta";
    let propostaInstallazione = null;

    function eGiaInstallata() {
        return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    }

    function leggiPreferenzaNascosto() {
        try { return window.localStorage.getItem(CHIAVE_MEMORIA_NASCOSTO) === "si"; } catch (errore) { return false; }
    }

    function salvaPreferenzaNascosto() {
        try { window.localStorage.setItem(CHIAVE_MEMORIA_NASCOSTO, "si"); } catch (errore) { /* memoria non disponibile */ }
    }

    function mostraElementi(selettore, visibili) {
        document.querySelectorAll(selettore).forEach(function imposta(elemento) { elemento.hidden = !visibili; });
    }

    function registraServizioOffline() {
        if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
        navigator.serviceWorker.register("servizio_offline.js", { scope: "./" }).catch(function registrazioneFallita(errore) {
            console.warn("Service worker non registrato:", errore);
        });
    }

    function collegaPulsanti() {
        document.querySelectorAll("[data-installa-app]").forEach(function collega(pulsante) {
            pulsante.addEventListener("click", function installa() {
                if (!propostaInstallazione) return;
                propostaInstallazione.prompt();
                propostaInstallazione.userChoice.finally(function dopoScelta() {
                    propostaInstallazione = null;
                    mostraElementi("[data-installa-app]", false);
                });
            });
        });
        document.querySelectorAll("[data-nascondi-installazione]").forEach(function collega(pulsante) {
            pulsante.addEventListener("click", function nascondi() {
                salvaPreferenzaNascosto();
                mostraElementi("[data-istruzioni-installazione]", false);
            });
        });
    }

    window.addEventListener("beforeinstallprompt", function memorizzaProposta(evento) {
        evento.preventDefault();
        propostaInstallazione = evento;
        mostraElementi("[data-installa-app]", true);
    });

    window.addEventListener("appinstalled", function installata() {
        mostraElementi("[data-installa-app]", false);
        mostraElementi("[data-istruzioni-installazione]", false);
    });

    registraServizioOffline();
    collegaPulsanti();
    mostraElementi("[data-istruzioni-installazione]", !eGiaInstallata() && !leggiPreferenzaNascosto());
})();
