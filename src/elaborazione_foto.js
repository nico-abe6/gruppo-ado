/*
 * elaborazione_foto.js
 *
 * Prepara una foto scelta dal telefono prima dell'invio:
 *   - la ruota secondo l'orientamento salvato dalla fotocamera;
 *   - la riduce a latoMassimoFotoPixel sul lato lungo;
 *   - la ricomprime in JPEG. La ricompressione elimina i metadati
 *     (data, modello del telefono, posizione GPS).
 * Se il file risultante supera il limite, riduce progressivamente la qualita'.
 */
(function inizializzaElaborazioneFoto(ambitoGlobale) {
    "use strict";

    /* apriImmagineDaFile: decodifica il file in un'immagine disegnabile. */
    async function apriImmagineDaFile(file) {
        if (ambitoGlobale.createImageBitmap) {
            try {
                return await ambitoGlobale.createImageBitmap(file, { imageOrientation: "from-image" });
            } catch (erroreBitmap) {
                // Alcuni browser non accettano le opzioni: si riprova nel modo classico.
            }
        }
        return new Promise(function caricaConElementoImmagine(risolvi, rifiuta) {
            const indirizzoTemporaneo = URL.createObjectURL(file);
            const immagine = new Image();
            immagine.onload = function immagineCaricata() { URL.revokeObjectURL(indirizzoTemporaneo); risolvi(immagine); };
            immagine.onerror = function immagineNonCaricata() { URL.revokeObjectURL(indirizzoTemporaneo); rifiuta(new Error("foto_non_leggibile")); };
            immagine.src = indirizzoTemporaneo;
        });
    }

    /* convertiTelaInJpeg: esporta la tela come JPEG con la qualita' indicata. */
    function convertiTelaInJpeg(tela, qualita) {
        return new Promise(function esporta(risolvi, rifiuta) {
            tela.toBlob(function esportato(datiJpeg) {
                if (datiJpeg) { risolvi(datiJpeg); } else { rifiuta(new Error("foto_non_leggibile")); }
            }, "image/jpeg", qualita);
        });
    }

    /*
     * preparaFotoPerInvio(file, configurazione)
     * Restituisce un Blob JPEG pronto da caricare.
     * Errori possibili: "foto_non_leggibile", "foto_troppo_grande".
     */
    async function preparaFotoPerInvio(file, configurazione) {
        let immagine;
        try {
            immagine = await apriImmagineDaFile(file);
        } catch (errore) {
            throw new Error("foto_non_leggibile");
        }
        const larghezzaOriginale = immagine.width;
        const altezzaOriginale = immagine.height;
        if (!larghezzaOriginale || !altezzaOriginale) { throw new Error("foto_non_leggibile"); }

        const fattore = Math.min(1, configurazione.latoMassimoFotoPixel / Math.max(larghezzaOriginale, altezzaOriginale));
        const tela = document.createElement("canvas");
        tela.width = Math.round(larghezzaOriginale * fattore);
        tela.height = Math.round(altezzaOriginale * fattore);
        const contesto = tela.getContext("2d");
        contesto.fillStyle = "#ffffff"; // sfondo bianco per PNG trasparenti
        contesto.fillRect(0, 0, tela.width, tela.height);
        contesto.drawImage(immagine, 0, 0, tela.width, tela.height);
        if (immagine.close) { immagine.close(); }

        let qualita = configurazione.qualitaFotoJpeg;
        let datiJpeg = await convertiTelaInJpeg(tela, qualita);
        while (datiJpeg.size > configurazione.dimensioneMassimaFileFotoByte && qualita > 0.4) {
            qualita -= 0.1;
            datiJpeg = await convertiTelaInJpeg(tela, qualita);
        }
        if (datiJpeg.size > configurazione.dimensioneMassimaFileFotoByte) { throw new Error("foto_troppo_grande"); }
        return datiJpeg;
    }

    ambitoGlobale.ElaborazioneFoto = { preparaFotoPerInvio: preparaFotoPerInvio };
})(window);
