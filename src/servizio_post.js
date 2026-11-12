/*
 * servizio_post.js
 *
 * Operazioni sui post della bacheca, usate sia dalla bacheca sia dall'area
 * educatori: lettura, pubblicazione (con foto facoltativa), approvazione,
 * eliminazione (post e relativa foto), indirizzo pubblico delle foto.
 */
(function inizializzaServizioPost(ambitoGlobale) {
    "use strict";

    const CAMPI_POST = "id, testo, firma, percorso_foto, da_educatori, approvato, creato_il";

    /* creaNomeFileFoto: nome casuale, l'unico formato accettato dal database. */
    function creaNomeFileFoto() {
        const identificativo = ambitoGlobale.crypto.randomUUID
            ? ambitoGlobale.crypto.randomUUID()
            : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function cifraCasuale(carattere) {
                return (carattere ^ (ambitoGlobale.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (carattere / 4)))).toString(16);
            });
        return identificativo + ".jpg";
    }

    /* ottieniIndirizzoPubblicoFoto: URL da usare in <img src>. */
    function ottieniIndirizzoPubblicoFoto(clientDatabase, configurazione, percorsoFoto) {
        return clientDatabase.storage.from(configurazione.nomeContenitoreFoto).getPublicUrl(percorsoFoto).data.publicUrl;
    }

    /* leggiPostRecenti: post piu' recenti (per i ragazzi il database restituisce solo quelli approvati). */
    function leggiPostRecenti(clientDatabase, configurazione) {
        return clientDatabase
            .from("post_bacheca")
            .select(CAMPI_POST)
            .order("creato_il", { ascending: false })
            .limit(configurazione.numeroMassimoPostMostrati);
    }

    /* leggiImpostazioniBacheca: legge la riga unica delle impostazioni. */
    function leggiImpostazioniBacheca(clientDatabase) {
        return clientDatabase.from("impostazioni_bacheca").select("foto_richiedono_approvazione").eq("id", 1).single();
    }

    /*
     * pubblicaPost(clientDatabase, configurazione, datiPost)
     * datiPost: { testo, firma, fotoJpeg (Blob o null), daEducatori (bool) }
     * Carica prima la foto, poi crea il post. Se la creazione fallisce,
     * prova a eliminare la foto appena caricata (riesce solo agli educatori).
     */
    async function pubblicaPost(clientDatabase, configurazione, datiPost) {
        let percorsoFoto = null;
        if (datiPost.fotoJpeg) {
            percorsoFoto = creaNomeFileFoto();
            const caricamento = await clientDatabase.storage
                .from(configurazione.nomeContenitoreFoto)
                .upload(percorsoFoto, datiPost.fotoJpeg, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
            if (caricamento.error) { return { error: caricamento.error }; }
        }

        const nuovoPost = { testo: datiPost.testo || null, firma: datiPost.firma || null, percorso_foto: percorsoFoto };
        if (datiPost.daEducatori) { nuovoPost.da_educatori = true; }
        const inserimento = await clientDatabase.from("post_bacheca").insert(nuovoPost);
        if (inserimento.error && percorsoFoto) {
            await clientDatabase.storage.from(configurazione.nomeContenitoreFoto).remove([percorsoFoto]);
        }
        return { error: inserimento.error || null };
    }

    /* approvaPost: rende visibile a tutti un post in attesa (solo educatori). */
    function approvaPost(clientDatabase, idPost) {
        return clientDatabase.from("post_bacheca").update({ approvato: true }).eq("id", idPost);
    }

    /* eliminaPostEFoto: elimina la foto (se c'e') e poi il post (solo educatori). */
    async function eliminaPostEFoto(clientDatabase, configurazione, post) {
        if (post.percorso_foto) {
            const rimozione = await clientDatabase.storage.from(configurazione.nomeContenitoreFoto).remove([post.percorso_foto]);
            if (rimozione.error) { return { error: rimozione.error }; }
        }
        return clientDatabase.from("post_bacheca").delete().eq("id", post.id);
    }

    ambitoGlobale.ServizioPost = {
        ottieniIndirizzoPubblicoFoto: ottieniIndirizzoPubblicoFoto,
        leggiPostRecenti: leggiPostRecenti,
        leggiImpostazioniBacheca: leggiImpostazioniBacheca,
        pubblicaPost: pubblicaPost,
        approvaPost: approvaPost,
        eliminaPostEFoto: eliminaPostEFoto
    };
})(window);
