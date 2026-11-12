/*
 * pagina_bacheca.js
 *
 * Logica della pagina principale (index.html), impaginata come un profilo social:
 *   - navigazione tra le viste #bacheca, #nuovo, #spazio (barra in basso);
 *   - profilo: logo, nome, numero di post, descrizione e link degli educatori;
 *   - post in griglia (miniature) o in elenco (schede complete);
 *   - pubblicazione di un post con foto, frase o entrambe.
 * Lo spazio personale e' gestito da spazio_personale.js.
 *
 * Dipende da: UtilitaComuni, ElaborazioneFoto, ServizioPost, SpazioPersonale.
 */
(function avviaPaginaBacheca() {
    "use strict";

    const utilita = window.UtilitaComuni;
    const servizioPost = window.ServizioPost;
    const configurazione = utilita.configurazione;
    const testo = utilita.ottieniTestoInterfaccia;
    const clientDatabase = utilita.creaClientSupabaseDaConfigurazione();

    const VISTE_DISPONIBILI = ["bacheca", "nuovo", "spazio"];
    const VISTA_INIZIALE = "bacheca";
    const NUMERO_COLORI_POST_SOLO_TESTO = 4;

    const elementi = {
        viste: {
            bacheca: document.getElementById("vista-bacheca"),
            nuovo: document.getElementById("vista-nuovo"),
            spazio: document.getElementById("vista-spazio")
        },
        vociNavigazione: document.querySelectorAll("[data-vista-destinazione]"),
        numeroPost: document.getElementById("numero-post"),
        bioProfilo: document.getElementById("bio-profilo"),
        schedaGriglia: document.getElementById("scheda-griglia"),
        schedaElenco: document.getElementById("scheda-elenco"),
        grigliaPost: document.getElementById("griglia-post"),
        elencoPost: document.getElementById("elenco-post"),
        moduloNuovoPost: document.getElementById("modulo-nuovo-post"),
        sceltaFoto: document.getElementById("scelta-foto"),
        campoFotoPost: document.getElementById("campo-foto-post"),
        anteprimaFoto: document.getElementById("anteprima-foto"),
        azioniFoto: document.getElementById("azioni-foto"),
        pulsanteTogliFoto: document.getElementById("pulsante-togli-foto"),
        campoTestoPost: document.getElementById("campo-testo-post"),
        campoFirmaPost: document.getElementById("campo-firma-post"),
        contatoreCaratteriPost: document.getElementById("contatore-caratteri-post"),
        pulsantePubblicaPost: document.getElementById("pulsante-pubblica-post"),
        statoNuovoPost: document.getElementById("stato-nuovo-post")
    };

    /* Foto pronta per l'invio (Blob JPEG) e indirizzo temporaneo dell'anteprima. */
    let fotoPreparata = null;
    let indirizzoAnteprima = null;

    /* Percorso del logo (o del segnaposto), usato anche come avatar degli educatori. */
    let percorsoLogoInUso = configurazione.percorsoLogoSegnaposto;

    // =========================================================================
    // Navigazione tra le viste
    // =========================================================================

    /* mostraVistaDaIndirizzo: mostra la vista indicata dopo # nell'indirizzo. */
    function mostraVistaDaIndirizzo() {
        const richiesta = window.location.hash.replace("#", "");
        const vistaDaMostrare = VISTE_DISPONIBILI.indexOf(richiesta) >= 0 ? richiesta : VISTA_INIZIALE;
        VISTE_DISPONIBILI.forEach(function aggiornaVista(nomeVista) {
            elementi.viste[nomeVista].hidden = nomeVista !== vistaDaMostrare;
        });
        elementi.vociNavigazione.forEach(function aggiornaVoce(voce) {
            if (voce.dataset.vistaDestinazione === vistaDaMostrare) {
                voce.setAttribute("aria-current", "page");
            } else {
                voce.removeAttribute("aria-current");
            }
        });
        window.scrollTo(0, 0);
    }

    // =========================================================================
    // Profilo: descrizione e link degli educatori
    // =========================================================================

    /* caricaEMostraBioProfilo: frasi e link degli educatori sotto il logo. */
    async function caricaEMostraBioProfilo() {
        const risposta = await clientDatabase
            .from("contenuti_educatori")
            .select("id, testo, indirizzo_link, ordine, creato_il")
            .order("ordine", { ascending: true })
            .order("creato_il", { ascending: true });

        elementi.bioProfilo.replaceChildren();
        if (risposta.error) {
            elementi.bioProfilo.append(utilita.creaElementoConTesto("li", "testo-vuoto", testo("erroreCaricamento")));
            return;
        }
        if (risposta.data.length === 0) {
            elementi.bioProfilo.append(utilita.creaElementoConTesto("li", "testo-vuoto", testo("nessunContenutoEducatori")));
            return;
        }
        risposta.data.forEach(function aggiungiVoceBio(contenuto) {
            const voce = utilita.creaElementoConTesto("li", "voce-bio");
            voce.append(utilita.creaElementoConTesto("span", "", contenuto.testo));
            if (utilita.eIndirizzoWebValido(contenuto.indirizzo_link)) {
                const link = utilita.creaElementoConTesto("a", "link-bio");
                link.href = contenuto.indirizzo_link.trim();
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.append(creaIcona("icona-link"), document.createTextNode(mostraIndirizzoBreve(contenuto.indirizzo_link)));
                voce.append(link);
            }
            elementi.bioProfilo.append(voce);
        });
    }

    /* mostraIndirizzoBreve: toglie https:// e www. per mostrare il link in modo compatto. */
    function mostraIndirizzoBreve(indirizzo) {
        return indirizzo.trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
    }

    /* creaIcona: richiama un'icona definita nel <svg> in cima alla pagina. */
    function creaIcona(idIcona) {
        const spazioNomiSvg = "http://www.w3.org/2000/svg";
        const icona = document.createElementNS(spazioNomiSvg, "svg");
        icona.setAttribute("class", "icona");
        icona.setAttribute("aria-hidden", "true");
        const uso = document.createElementNS(spazioNomiSvg, "use");
        uso.setAttribute("href", "#" + idIcona);
        icona.append(uso);
        return icona;
    }

    // =========================================================================
    // Post: griglia ed elenco
    // =========================================================================

    /* classeColorePostSoloTesto: colore stabile per i post senza foto. */
    function classeColorePostSoloTesto(post) {
        return "colore-post-" + ((post.id % NUMERO_COLORI_POST_SOLO_TESTO) + 1);
    }

    /* nomeAutorePost: firma, "Anonimo" o nome del gruppo per gli educatori senza firma. */
    function nomeAutorePost(post) {
        if (post.firma) { return post.firma; }
        return post.da_educatori ? configurazione.nomeGruppo : testo("firmaAnonima");
    }

    /* creaAvatarAutore: logo per gli educatori, iniziale per chi firma, sagoma per gli anonimi. */
    function creaAvatarAutore(post) {
        const avatar = utilita.creaElementoConTesto("span", "avatar-post");
        avatar.setAttribute("aria-hidden", "true");
        if (post.da_educatori) {
            const logo = document.createElement("img");
            logo.src = percorsoLogoInUso;
            logo.alt = "";
            avatar.append(logo);
        } else if (post.firma) {
            avatar.textContent = post.firma.trim().charAt(0).toUpperCase();
            avatar.classList.add(classeColorePostSoloTesto(post));
        } else {
            avatar.classList.add("avatar-anonimo");
            avatar.append(creaIcona("icona-persona"));
        }
        return avatar;
    }

    /* creaMiniaturaPost: casella della griglia; aprendola si va al post in elenco. */
    function creaMiniaturaPost(post) {
        const miniatura = utilita.creaElementoConTesto("button", "miniatura-post");
        miniatura.type = "button";
        miniatura.setAttribute("aria-label", testo("apriPost") + ": " + (post.testo || nomeAutorePost(post)));
        if (post.percorso_foto) {
            const immagine = document.createElement("img");
            immagine.src = servizioPost.ottieniIndirizzoPubblicoFoto(clientDatabase, configurazione, post.percorso_foto);
            immagine.alt = "";
            immagine.loading = "lazy";
            miniatura.append(immagine);
        } else {
            miniatura.classList.add(classeColorePostSoloTesto(post));
            miniatura.append(utilita.creaElementoConTesto("span", "testo-miniatura", post.testo));
        }
        miniatura.addEventListener("click", function apriPostInElenco() {
            selezionaScheda("elenco");
            const scheda = document.getElementById("post-" + post.id);
            if (scheda) { scheda.scrollIntoView({ block: "start" }); }
        });
        return miniatura;
    }

    /* creaSchedaPost: post completo, come in un feed. */
    function creaSchedaPost(post) {
        const scheda = utilita.creaElementoConTesto("article", "scheda-post");
        scheda.id = "post-" + post.id;

        const intestazione = utilita.creaElementoConTesto("header", "intestazione-post");
        const autore = utilita.creaElementoConTesto("div", "autore-post");
        autore.append(utilita.creaElementoConTesto("strong", "", nomeAutorePost(post)));
        if (post.da_educatori) {
            autore.append(utilita.creaElementoConTesto("span", "etichetta-educatori", testo("etichettaEducatori")));
        }
        const data = utilita.creaElementoConTesto("time", "data-post", utilita.formattaDataOraLocale(post.creato_il));
        data.dateTime = post.creato_il;
        intestazione.append(creaAvatarAutore(post), autore, data);
        scheda.append(intestazione);

        if (post.percorso_foto) {
            const immagine = document.createElement("img");
            immagine.className = "foto-post";
            immagine.src = servizioPost.ottieniIndirizzoPubblicoFoto(clientDatabase, configurazione, post.percorso_foto);
            immagine.alt = post.testo || "";
            immagine.loading = "lazy";
            scheda.append(immagine);
            if (post.testo) {
                const didascalia = utilita.creaElementoConTesto("p", "didascalia-post");
                didascalia.append(utilita.creaElementoConTesto("strong", "", nomeAutorePost(post)), document.createTextNode(" " + post.testo));
                scheda.append(didascalia);
            }
        } else {
            const riquadro = utilita.creaElementoConTesto("div", "post-solo-testo " + classeColorePostSoloTesto(post));
            riquadro.append(utilita.creaElementoConTesto("p", "", post.testo));
            scheda.append(riquadro);
        }
        return scheda;
    }

    /* caricaEMostraPost: legge i post e riempie griglia, elenco e contatore. */
    async function caricaEMostraPost() {
        const risposta = await servizioPost.leggiPostRecenti(clientDatabase, configurazione);
        elementi.grigliaPost.replaceChildren();
        elementi.elencoPost.replaceChildren();

        if (risposta.error) {
            elementi.grigliaPost.append(utilita.creaElementoConTesto("p", "testo-vuoto messaggio-vuoto", testo("erroreCaricamento")));
            elementi.numeroPost.textContent = "";
            return;
        }
        elementi.numeroPost.textContent = testo("numeroPost", { numero: risposta.data.length });
        if (risposta.data.length === 0) {
            elementi.grigliaPost.append(utilita.creaElementoConTesto("p", "testo-vuoto messaggio-vuoto", testo("nessunPost")));
            elementi.elencoPost.append(utilita.creaElementoConTesto("p", "testo-vuoto messaggio-vuoto", testo("nessunPost")));
            return;
        }
        risposta.data.forEach(function aggiungiPost(post) {
            elementi.grigliaPost.append(creaMiniaturaPost(post));
            elementi.elencoPost.append(creaSchedaPost(post));
        });
    }

    /* selezionaScheda: passa tra "griglia" ed "elenco". */
    function selezionaScheda(nomeScheda) {
        const mostraGriglia = nomeScheda === "griglia";
        elementi.grigliaPost.hidden = !mostraGriglia;
        elementi.elencoPost.hidden = mostraGriglia;
        elementi.schedaGriglia.setAttribute("aria-selected", String(mostraGriglia));
        elementi.schedaElenco.setAttribute("aria-selected", String(!mostraGriglia));
    }

    // =========================================================================
    // Nuovo post
    // =========================================================================

    /* aggiornaContatoreCaratteriPost: mostra quanti caratteri restano. */
    function aggiornaContatoreCaratteriPost() {
        const rimasti = configurazione.lunghezzaMassimaPost - elementi.campoTestoPost.value.length;
        elementi.contatoreCaratteriPost.textContent = testo("caratteriRimasti", { rimasti: rimasti });
    }

    /* togliFotoScelta: torna al riquadro "Scegli una foto". */
    function togliFotoScelta() {
        fotoPreparata = null;
        if (indirizzoAnteprima) { URL.revokeObjectURL(indirizzoAnteprima); indirizzoAnteprima = null; }
        elementi.campoFotoPost.value = "";
        elementi.anteprimaFoto.hidden = true;
        elementi.anteprimaFoto.removeAttribute("src");
        elementi.azioniFoto.hidden = true;
        elementi.sceltaFoto.hidden = false;
    }

    /* preparaFotoScelta: ridimensiona la foto appena scelta e ne mostra l'anteprima. */
    async function preparaFotoScelta() {
        const file = elementi.campoFotoPost.files && elementi.campoFotoPost.files[0];
        if (!file) { return; }
        utilita.mostraMessaggioDiStato(elementi.statoNuovoPost, "");
        elementi.pulsantePubblicaPost.disabled = true;
        try {
            const fotoJpeg = await window.ElaborazioneFoto.preparaFotoPerInvio(file, configurazione);
            togliFotoScelta();
            fotoPreparata = fotoJpeg;
            indirizzoAnteprima = URL.createObjectURL(fotoJpeg);
            elementi.anteprimaFoto.src = indirizzoAnteprima;
            elementi.anteprimaFoto.hidden = false;
            elementi.azioniFoto.hidden = false;
            elementi.sceltaFoto.hidden = true;
        } catch (errore) {
            togliFotoScelta();
            const chiaveErrore = errore.message === "foto_troppo_grande" ? "fotoTroppoGrande" : "fotoNonLeggibile";
            utilita.mostraMessaggioDiStato(elementi.statoNuovoPost, chiaveErrore, "errore");
        } finally {
            elementi.pulsantePubblicaPost.disabled = false;
        }
    }

    /* pubblicaNuovoPost: invia foto e/o frase, poi torna alla bacheca. */
    async function pubblicaNuovoPost(evento) {
        evento.preventDefault();
        const testoPost = elementi.campoTestoPost.value.trim();
        const firmaPost = elementi.campoFirmaPost.value.trim();
        if (!testoPost && !fotoPreparata) {
            utilita.mostraMessaggioDiStato(elementi.statoNuovoPost, "postVuoto", "errore");
            return;
        }

        elementi.pulsantePubblicaPost.disabled = true;
        utilita.mostraMessaggioDiStato(elementi.statoNuovoPost, "pubblicazioneInCorso", "info");
        const conFoto = Boolean(fotoPreparata);
        const esito = await servizioPost.pubblicaPost(clientDatabase, configurazione,
            { testo: testoPost, firma: firmaPost, fotoJpeg: fotoPreparata, daEducatori: false });
        elementi.pulsantePubblicaPost.disabled = false;

        if (esito.error) {
            console.error("Pubblicazione non riuscita:", esito.error);
            utilita.mostraMessaggioDiStato(elementi.statoNuovoPost, "erroreGenerico", "errore");
            return;
        }

        let inAttesaDiApprovazione = false;
        if (conFoto) {
            const impostazioni = await servizioPost.leggiImpostazioniBacheca(clientDatabase);
            inAttesaDiApprovazione = Boolean(impostazioni.data && impostazioni.data.foto_richiedono_approvazione);
        }

        elementi.campoTestoPost.value = "";
        togliFotoScelta();
        aggiornaContatoreCaratteriPost();

        if (inAttesaDiApprovazione) {
            utilita.mostraMessaggioDiStato(elementi.statoNuovoPost, "postInAttesa", "ok");
            return;
        }
        utilita.mostraMessaggioDiStato(elementi.statoNuovoPost, "");
        await caricaEMostraPost();
        selezionaScheda("elenco");
        window.location.hash = "#bacheca";
    }

    // =========================================================================
    // Avvio
    // =========================================================================

    async function avviaPagina() {
        utilita.applicaTestiInterfacciaAllaPagina();
        const promessaLogo = utilita.applicaLogoAllaPagina();
        document.title = configurazione.nomeGruppo;
        document.querySelectorAll("[data-nome-gruppo]").forEach(function impostaNome(elemento) {
            elemento.textContent = configurazione.nomeGruppo;
        });

        elementi.campoTestoPost.maxLength = configurazione.lunghezzaMassimaPost;
        elementi.campoFirmaPost.maxLength = configurazione.lunghezzaMassimaFirma;
        aggiornaContatoreCaratteriPost();

        elementi.schedaGriglia.addEventListener("click", function mostraGriglia() { selezionaScheda("griglia"); });
        elementi.schedaElenco.addEventListener("click", function mostraElenco() { selezionaScheda("elenco"); });
        elementi.campoTestoPost.addEventListener("input", aggiornaContatoreCaratteriPost);
        elementi.campoFotoPost.addEventListener("change", preparaFotoScelta);
        elementi.pulsanteTogliFoto.addEventListener("click", togliFotoScelta);
        elementi.moduloNuovoPost.addEventListener("submit", pubblicaNuovoPost);
        window.addEventListener("hashchange", mostraVistaDaIndirizzo);

        window.SpazioPersonale.avviaSpazioPersonale(clientDatabase);
        mostraVistaDaIndirizzo();
        caricaEMostraBioProfilo();
        percorsoLogoInUso = await promessaLogo;
        caricaEMostraPost();
    }

    avviaPagina();
})();
