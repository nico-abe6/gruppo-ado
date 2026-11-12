/*
 * configurazione.js
 *
 * Impostazioni della Bacheca QR. E' l'unico file da modificare per
 * collegare la pagina al proprio progetto Supabase.
 *
 * indirizzoSupabase e chiavePubblicaSupabase si trovano nel pannello
 * Supabase in Project Settings > API (o "API Keys"). Usare la chiave
 * pubblica ("publishable" o "anon"), MAI la chiave "secret" / "service_role".
 * La chiave pubblica puo' stare nel codice: la sicurezza dei dati e'
 * garantita dalle regole in database/01_crea_tabelle_e_regole.sql.
 */
window.CONFIGURAZIONE_BACHECA = {
    indirizzoSupabase: "https://nalmepfefqkkqfjmkvgl.supabase.co",
    chiavePubblicaSupabase: "sb_publishable_ogp4F9ICPnsaWI79r0NN_A_qCK3SX8L",

    // Nome mostrato in cima alla pagina e sotto il logo.
    nomeGruppo: "Oratorio di Gussago",

    // Logo mostrato nella barra in alto, nel profilo e come icona della pagina.
    // Percorso relativo alle pagine in src/. Se il file manca, viene usato
    // il segnaposto risorse_grafiche/logo_segnaposto.svg.
    percorsoLogo: "../risorse_grafiche/logo_oratorio.png",
    percorsoLogoSegnaposto: "../risorse_grafiche/logo_segnaposto.svg",

    // Lingua dei testi (vedi config/testi_interfaccia.js).
    // Le date usano la lingua del telefono di chi apre la pagina.
    linguaInterfaccia: "it",

    // Quanti post dei ragazzi mostrare al massimo (i piu' recenti).
    numeroMassimoPostMostrati: 100,

    // Devono coincidere con i controlli nel file SQL.
    lunghezzaMassimaPost: 500,
    lunghezzaMassimaFirma: 40,
    lunghezzaMassimaContenutoEducatori: 1000,

    // Foto: vengono ridimensionate e ricompresse sul telefono prima dell'invio.
    // La ricompressione elimina anche i metadati (es. posizione GPS).
    // dimensioneMassimaFileFotoByte deve coincidere con il limite nel file SQL.
    nomeContenitoreFoto: "foto_post",
    latoMassimoFotoPixel: 1440,
    qualitaFotoJpeg: 0.82,
    dimensioneMassimaFileFotoByte: 3145728,

    // Regole per gli spazi personali.
    lunghezzaMinimaPassword: 8,
    // Iterazioni PBKDF2 per i NUOVI spazi. Gli spazi gia' creati conservano
    // il proprio valore, quindi si puo' cambiare senza rompere nulla.
    iterazioniDerivazionePassword: 600000
};
