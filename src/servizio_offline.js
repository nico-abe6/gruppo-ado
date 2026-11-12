/*
 * servizio_offline.js (service worker)
 *
 * Serve a rendere la bacheca e l'area educatori installabili sul telefono
 * come app. Strategia "prima la rete": ogni file del sito viene sempre
 * scaricato aggiornato; la copia salvata si usa solo se manca la connessione,
 * cosi' l'app si apre (senza post nuovi) anche offline.
 * Le richieste verso altri siti (database Supabase, librerie, caratteri)
 * non vengono toccate.
 *
 * Se si modifica questo file, aumentare VERSIONE_CACHE: le copie vecchie
 * vengono eliminate al prossimo avvio.
 */
const VERSIONE_CACHE = "bacheca-qr-v1";

self.addEventListener("install", function installaServizio() {
    self.skipWaiting();
});

self.addEventListener("activate", function attivaServizio(evento) {
    evento.waitUntil(
        caches.keys()
            .then(function eliminaCacheVecchie(nomi) {
                return Promise.all(nomi
                    .filter(function eVecchia(nome) { return nome !== VERSIONE_CACHE; })
                    .map(function elimina(nome) { return caches.delete(nome); }));
            })
            .then(function prendiControllo() { return self.clients.claim(); })
    );
});

self.addEventListener("fetch", function gestisciRichiesta(evento) {
    const richiesta = evento.request;
    if (richiesta.method !== "GET" || new URL(richiesta.url).origin !== self.location.origin) {
        return;
    }
    evento.respondWith(
        fetch(richiesta)
            .then(function salvaCopia(risposta) {
                if (risposta.ok) {
                    const copia = risposta.clone();
                    caches.open(VERSIONE_CACHE).then(function scrivi(cache) { cache.put(richiesta, copia); });
                }
                return risposta;
            })
            .catch(function usaCopiaSalvata() {
                return caches.match(richiesta, { ignoreSearch: true });
            })
    );
});
