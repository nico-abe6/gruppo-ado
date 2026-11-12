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

    // Marchio (simbolo) mostrato nei cerchi: profilo, post degli educatori,
    // area educatori e icona della scheda del browser.
    // Percorso relativo alle pagine in src/. Se il file manca, viene usato
    // il segnaposto risorse_grafiche/logo_segnaposto.svg.
    percorsoLogo: "../risorse_grafiche/marchio_oratorio.svg",
    percorsoLogoSegnaposto: "../risorse_grafiche/logo_segnaposto.svg",

    // Logo esteso (scritta) mostrato nella barra in alto della bacheca al
    // posto di marchio + nome. Lasciare "" per usare marchio + nomeGruppo.
    percorsoLogoEsteso: "../risorse_grafiche/logo_oratorio.svg",

    // Accesso educatori con il nome invece dell'email.
    // Supabase richiede comunque un'email: la pagina la costruisce dal nome
    // (es. "Maria Rossi" -> "maria.rossi@" + dominioAccessoEducatori).
    // Gli account vanno creati in Supabase con queste email (README, passo 3).
    // Il dominio non deve ricevere posta: con la conferma automatica Supabase
    // non invia email. ".invalid" e' un dominio riservato che non esiste.
    dominioAccessoEducatori: "educatori.oratorio.invalid",

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
    // Immagini negli spazi personali (cifrate sul telefono come gli appunti).
    // numeroMassimoImmaginiSpazio e dimensioneMassimaImmagineSpazioByte devono
    // coincidere con i limiti in database/02_immagini_spazi_personali.sql
    // (700000 byte di JPEG diventano circa 933 000 caratteri cifrati, sotto
    // il limite di 1 000 000).
    numeroMassimoImmaginiSpazio: 20,
    latoMassimoImmagineSpazioPixel: 1280,
    qualitaImmagineSpazioJpeg: 0.8,
    dimensioneMassimaImmagineSpazioByte: 700000,

    // Iterazioni PBKDF2 per i NUOVI spazi. Gli spazi gia' creati conservano
    // il proprio valore, quindi si puo' cambiare senza rompere nulla.
    iterazioniDerivazionePassword: 600000
};
