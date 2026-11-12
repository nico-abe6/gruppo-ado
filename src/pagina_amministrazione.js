/*
 * pagina_amministrazione.js
 *
 * Logica dell'area educatori (amministrazione.html):
 *   - login e logout con gli account creati nel pannello Supabase;
 *   - impostazione "le foto dei ragazzi richiedono approvazione";
 *   - approvazione o eliminazione delle foto in attesa;
 *   - pubblicazione di post come educatori (foto, frase o entrambe);
 *   - descrizione del profilo e link (aggiunta ed eliminazione);
 *   - eliminazione dei post pubblicati (con la loro foto).
 *
 * I permessi reali sono controllati dal database (regole RLS e Storage):
 * questa pagina mostra solo l'interfaccia.
 */
(function avviaPaginaAmministrazione() {
    "use strict";

    const utilita = window.UtilitaComuni;
    const servizioPost = window.ServizioPost;
    const configurazione = utilita.configurazione;
    const testo = utilita.ottieniTestoInterfaccia;
    const clientDatabase = utilita.creaClientSupabaseDaConfigurazione();

    const elementi = {
        moduloAccesso: document.getElementById("modulo-accesso-educatore"),
        campoNome: document.getElementById("campo-nome-educatore"),
        campoPassword: document.getElementById("campo-password-educatore"),
        pulsanteAccedi: document.getElementById("pulsante-accedi-educatore"),
        statoAccesso: document.getElementById("stato-accesso-educatore"),
        pannelloGestione: document.getElementById("pannello-gestione"),
        pulsanteEsci: document.getElementById("pulsante-esci-educatore"),
        casellaApprovazioneFoto: document.getElementById("casella-approvazione-foto"),
        statoImpostazioni: document.getElementById("stato-impostazioni"),
        elencoDaApprovare: document.getElementById("elenco-da-approvare"),
        moduloPostEducatori: document.getElementById("modulo-post-educatori"),
        campoFotoEducatori: document.getElementById("campo-foto-educatori"),
        campoTestoPostEducatori: document.getElementById("campo-testo-post-educatori"),
        campoFirmaPostEducatori: document.getElementById("campo-firma-post-educatori"),
        pulsantePubblicaEducatori: document.getElementById("pulsante-pubblica-educatori"),
        statoPostEducatori: document.getElementById("stato-post-educatori"),
        moduloNuovoContenuto: document.getElementById("modulo-nuovo-contenuto"),
        campoTestoContenuto: document.getElementById("campo-testo-contenuto"),
        campoLinkContenuto: document.getElementById("campo-link-contenuto"),
        campoOrdineContenuto: document.getElementById("campo-ordine-contenuto"),
        pulsanteAggiungiContenuto: document.getElementById("pulsante-aggiungi-contenuto"),
        statoNuovoContenuto: document.getElementById("stato-nuovo-contenuto"),
        elencoGestioneContenuti: document.getElementById("elenco-gestione-contenuti"),
        elencoGestionePost: document.getElementById("elenco-gestione-post")
    };

    // =========================================================================
    // Accesso
    // =========================================================================

    /* mostraPannelloSeAutenticato: alterna modulo di login e pannello di gestione. */
    function mostraPannelloSeAutenticato(sessione) {
        const autenticato = Boolean(sessione);
        elementi.moduloAccesso.hidden = autenticato;
        elementi.pannelloGestione.hidden = !autenticato;
        if (autenticato) { aggiornaTuttoIlPannello(); }
    }

    function aggiornaTuttoIlPannello() {
        caricaImpostazioni();
        caricaEMostraPost();
        caricaEMostraContenutiDaGestire();
    }

    /* accediComeEducatore: login con nome e password (il nome diventa l'email di accesso). */
    async function accediComeEducatore(evento) {
        evento.preventDefault();
        const emailAccesso = utilita.convertiNomeInEmailEducatore(elementi.campoNome.value);
        if (!emailAccesso || !elementi.campoPassword.value) {
            utilita.mostraMessaggioDiStato(elementi.statoAccesso, "accessoNonRiuscito", "errore");
            return;
        }
        elementi.pulsanteAccedi.disabled = true;
        const risposta = await clientDatabase.auth.signInWithPassword({
            email: emailAccesso,
            password: elementi.campoPassword.value
        });
        elementi.pulsanteAccedi.disabled = false;
        elementi.campoPassword.value = "";
        if (risposta.error) {
            utilita.mostraMessaggioDiStato(elementi.statoAccesso, "accessoNonRiuscito", "errore");
            return;
        }
        utilita.mostraMessaggioDiStato(elementi.statoAccesso, "");
        mostraPannelloSeAutenticato(risposta.data.session);
    }

    /* esciDallAreaEducatori: logout. */
    async function esciDallAreaEducatori() {
        await clientDatabase.auth.signOut();
        mostraPannelloSeAutenticato(null);
    }

    // =========================================================================
    // Impostazioni
    // =========================================================================

    async function caricaImpostazioni() {
        const risposta = await servizioPost.leggiImpostazioniBacheca(clientDatabase);
        if (!risposta.error && risposta.data) {
            elementi.casellaApprovazioneFoto.checked = risposta.data.foto_richiedono_approvazione;
        }
    }

    /* salvaImpostazioneApprovazione: salva subito al cambio della casella. */
    async function salvaImpostazioneApprovazione() {
        elementi.casellaApprovazioneFoto.disabled = true;
        const risposta = await clientDatabase
            .from("impostazioni_bacheca")
            .update({ foto_richiedono_approvazione: elementi.casellaApprovazioneFoto.checked })
            .eq("id", 1);
        elementi.casellaApprovazioneFoto.disabled = false;
        if (risposta.error) {
            elementi.casellaApprovazioneFoto.checked = !elementi.casellaApprovazioneFoto.checked;
            utilita.mostraMessaggioDiStato(elementi.statoImpostazioni, "erroreGenerico", "errore");
            return;
        }
        utilita.mostraMessaggioDiStato(elementi.statoImpostazioni, "impostazioneSalvata", "ok");
    }

    // =========================================================================
    // Post: in attesa e pubblicati
    // =========================================================================

    /* creaVocePost: riga con miniatura, testo, firma, data e pulsanti. */
    function creaVocePost(post, conApprovazione) {
        const voce = utilita.creaElementoConTesto("li", "voce-gestione");
        if (post.percorso_foto) {
            const miniatura = document.createElement("img");
            miniatura.className = "miniatura-gestione";
            miniatura.src = servizioPost.ottieniIndirizzoPubblicoFoto(clientDatabase, configurazione, post.percorso_foto);
            miniatura.alt = "";
            miniatura.loading = "lazy";
            voce.append(miniatura);
        }
        const contenuto = utilita.creaElementoConTesto("div", "testo-voce-gestione", post.testo || "");
        const autore = post.firma || (post.da_educatori ? testo("etichettaEducatori") : testo("firmaAnonima"));
        contenuto.append(utilita.creaElementoConTesto("span", "dettaglio-voce-gestione",
            autore + "  " + utilita.formattaDataOraLocale(post.creato_il)));
        voce.append(contenuto);

        const azioni = utilita.creaElementoConTesto("div", "azioni-voce-gestione");
        if (conApprovazione) {
            const pulsanteApprova = utilita.creaElementoConTesto("button", "", testo("pulsanteApprova"));
            pulsanteApprova.type = "button";
            pulsanteApprova.addEventListener("click", async function approva() {
                pulsanteApprova.disabled = true;
                const esito = await servizioPost.approvaPost(clientDatabase, post.id);
                if (esito.error) { pulsanteApprova.disabled = false; window.alert(testo("erroreGenerico")); return; }
                caricaEMostraPost();
            });
            azioni.append(pulsanteApprova);
        }
        const pulsanteElimina = utilita.creaElementoConTesto("button", "pulsante-pericolo", testo("pulsanteElimina"));
        pulsanteElimina.type = "button";
        pulsanteElimina.addEventListener("click", async function elimina() {
            if (!window.confirm(testo("confermaEliminaPost"))) { return; }
            pulsanteElimina.disabled = true;
            const esito = await servizioPost.eliminaPostEFoto(clientDatabase, configurazione, post);
            if (esito.error) { pulsanteElimina.disabled = false; window.alert(testo("erroreGenerico")); return; }
            voce.remove();
        });
        azioni.append(pulsanteElimina);
        voce.append(azioni);
        return voce;
    }

    /* caricaEMostraPost: divide i post tra "da approvare" e "pubblicati". */
    async function caricaEMostraPost() {
        const risposta = await servizioPost.leggiPostRecenti(clientDatabase, configurazione);
        elementi.elencoDaApprovare.replaceChildren();
        elementi.elencoGestionePost.replaceChildren();
        if (risposta.error) {
            elementi.elencoGestionePost.append(utilita.creaElementoConTesto("li", "testo-vuoto", testo("erroreCaricamento")));
            return;
        }
        const daApprovare = risposta.data.filter(function inAttesa(post) { return !post.approvato; });
        const pubblicati = risposta.data.filter(function visibile(post) { return post.approvato; });

        if (daApprovare.length === 0) {
            elementi.elencoDaApprovare.append(utilita.creaElementoConTesto("li", "testo-vuoto", testo("nessunPostDaApprovare")));
        }
        daApprovare.forEach(function aggiungi(post) { elementi.elencoDaApprovare.append(creaVocePost(post, true)); });

        if (pubblicati.length === 0) {
            elementi.elencoGestionePost.append(utilita.creaElementoConTesto("li", "testo-vuoto", testo("nessunPost")));
        }
        pubblicati.forEach(function aggiungi(post) { elementi.elencoGestionePost.append(creaVocePost(post, false)); });
    }

    /* pubblicaPostComeEducatori: foto e/o frase con l'etichetta "Educatori". */
    async function pubblicaPostComeEducatori(evento) {
        evento.preventDefault();
        const testoPost = elementi.campoTestoPostEducatori.value.trim();
        const firmaPost = elementi.campoFirmaPostEducatori.value.trim();
        const file = elementi.campoFotoEducatori.files && elementi.campoFotoEducatori.files[0];
        if (!testoPost && !file) {
            utilita.mostraMessaggioDiStato(elementi.statoPostEducatori, "postVuoto", "errore");
            return;
        }

        elementi.pulsantePubblicaEducatori.disabled = true;
        utilita.mostraMessaggioDiStato(elementi.statoPostEducatori, "pubblicazioneInCorso", "info");
        try {
            const fotoJpeg = file ? await window.ElaborazioneFoto.preparaFotoPerInvio(file, configurazione) : null;
            const esito = await servizioPost.pubblicaPost(clientDatabase, configurazione,
                { testo: testoPost, firma: firmaPost, fotoJpeg: fotoJpeg, daEducatori: true });
            if (esito.error) { throw esito.error; }
            elementi.moduloPostEducatori.reset();
            utilita.mostraMessaggioDiStato(elementi.statoPostEducatori, "postPubblicato", "ok");
            caricaEMostraPost();
        } catch (errore) {
            console.error("Pubblicazione non riuscita:", errore);
            const chiave = errore && errore.message === "foto_troppo_grande" ? "fotoTroppoGrande"
                : errore && errore.message === "foto_non_leggibile" ? "fotoNonLeggibile" : "erroreGenerico";
            utilita.mostraMessaggioDiStato(elementi.statoPostEducatori, chiave, "errore");
        } finally {
            elementi.pulsantePubblicaEducatori.disabled = false;
        }
    }

    // =========================================================================
    // Descrizione del profilo e link
    // =========================================================================

    async function caricaEMostraContenutiDaGestire() {
        const risposta = await clientDatabase
            .from("contenuti_educatori")
            .select("id, testo, indirizzo_link, ordine")
            .order("ordine", { ascending: true })
            .order("creato_il", { ascending: true });
        elementi.elencoGestioneContenuti.replaceChildren();
        if (risposta.error) {
            elementi.elencoGestioneContenuti.append(utilita.creaElementoConTesto("li", "testo-vuoto", testo("erroreCaricamento")));
            return;
        }
        risposta.data.forEach(function aggiungiVoceContenuto(contenuto) {
            const voce = utilita.creaElementoConTesto("li", "voce-gestione");
            const testoVoce = utilita.creaElementoConTesto("div", "testo-voce-gestione", contenuto.testo);
            testoVoce.append(utilita.creaElementoConTesto("span", "dettaglio-voce-gestione",
                "#" + contenuto.ordine + (contenuto.indirizzo_link ? "  " + contenuto.indirizzo_link : "")));
            const pulsanteElimina = utilita.creaElementoConTesto("button", "pulsante-pericolo", testo("pulsanteElimina"));
            pulsanteElimina.type = "button";
            pulsanteElimina.addEventListener("click", async function elimina() {
                if (!window.confirm(testo("confermaEliminaContenuto"))) { return; }
                pulsanteElimina.disabled = true;
                const esito = await clientDatabase.from("contenuti_educatori").delete().eq("id", contenuto.id);
                if (esito.error) { pulsanteElimina.disabled = false; window.alert(testo("erroreGenerico")); return; }
                voce.remove();
            });
            voce.append(testoVoce, pulsanteElimina);
            elementi.elencoGestioneContenuti.append(voce);
        });
    }

    async function aggiungiNuovoContenuto(evento) {
        evento.preventDefault();
        const testoContenuto = elementi.campoTestoContenuto.value.trim();
        const link = elementi.campoLinkContenuto.value.trim();
        const ordine = parseInt(elementi.campoOrdineContenuto.value, 10);
        if (!testoContenuto) { elementi.campoTestoContenuto.focus(); return; }
        if (link && !utilita.eIndirizzoWebValido(link)) {
            utilita.mostraMessaggioDiStato(elementi.statoNuovoContenuto, "linkNonValido", "errore");
            return;
        }
        elementi.pulsanteAggiungiContenuto.disabled = true;
        const risposta = await clientDatabase.from("contenuti_educatori").insert({
            testo: testoContenuto,
            indirizzo_link: link || null,
            ordine: Number.isFinite(ordine) ? ordine : 0
        });
        elementi.pulsanteAggiungiContenuto.disabled = false;
        if (risposta.error) {
            utilita.mostraMessaggioDiStato(elementi.statoNuovoContenuto, "erroreGenerico", "errore");
            return;
        }
        elementi.campoTestoContenuto.value = "";
        elementi.campoLinkContenuto.value = "";
        utilita.mostraMessaggioDiStato(elementi.statoNuovoContenuto, "");
        caricaEMostraContenutiDaGestire();
    }

    // =========================================================================
    // Avvio
    // =========================================================================

    async function avviaPagina() {
        utilita.applicaTestiInterfacciaAllaPagina();
        utilita.applicaLogoAllaPagina();
        elementi.campoTestoContenuto.maxLength = configurazione.lunghezzaMassimaContenutoEducatori;
        elementi.campoTestoPostEducatori.maxLength = configurazione.lunghezzaMassimaPost;
        elementi.campoFirmaPostEducatori.maxLength = configurazione.lunghezzaMassimaFirma;

        elementi.moduloAccesso.addEventListener("submit", accediComeEducatore);
        elementi.pulsanteEsci.addEventListener("click", esciDallAreaEducatori);
        elementi.casellaApprovazioneFoto.addEventListener("change", salvaImpostazioneApprovazione);
        elementi.moduloPostEducatori.addEventListener("submit", pubblicaPostComeEducatori);
        elementi.moduloNuovoContenuto.addEventListener("submit", aggiungiNuovoContenuto);

        const sessioneCorrente = await clientDatabase.auth.getSession();
        mostraPannelloSeAutenticato(sessioneCorrente.data.session);
    }

    avviaPagina();
})();
