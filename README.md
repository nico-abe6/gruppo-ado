# Bacheca QR

Pagina web raggiungibile da un QR code unico, impaginata come un profilo social, con una barra di navigazione in basso a tre voci:

1. **Bacheca** (casa): profilo con logo dell'oratorio, descrizione e link scritti dagli educatori, poi i post in griglia o in elenco.
2. **Nuovo post** (+): chiunque pubblica una foto, una frase o entrambe, con firma facoltativa (anonimo se la firma è vuota). Gli educatori possono eliminarli e, se lo attivano, approvare le foto prima che compaiano. Anche gli educatori possono pubblicare post, contrassegnati con l'etichetta "Educatori".
3. **Il mio spazio** (quaderno): appunti personali protetti da nome e password, cifrati sul telefono. Né gli altri ragazzi né gli educatori possono leggerli.

Costo: zero, usando il piano gratuito di Supabase (database) e GitHub Pages (sito).

## Struttura del progetto

```
bacheca-qr/
├── index.html                      reindirizza a src/index.html
├── README.md                       questo file
├── risorse_grafiche/
│   ├── logo_oratorio.svg           logo con la scritta (barra in alto)
│   ├── marchio_oratorio.svg        simbolo (profilo, icone, post degli educatori)
│   ├── logo_segnaposto.svg         usato finché il logo manca
│   └── icone/                      icone per installare le app (create da strumenti/genera_icone_app.py)
├── config/
│   ├── configurazione.js           indirizzo database, chiave pubblica, nome gruppo, limiti
│   └── testi_interfaccia.js        tutti i testi delle pagine (per tradurre o modificare)
├── src/
│   ├── index.html                  pagina della bacheca (quella del QR code)
│   ├── amministrazione.html        area educatori
│   ├── stile_comune.css            grafica (colori, caratteri, tema chiaro/scuro)
│   ├── utilita_comuni.js           funzioni condivise (testi, date, logo, database)
│   ├── servizio_post.js            lettura, pubblicazione, approvazione, eliminazione dei post
│   ├── elaborazione_foto.js        ridimensiona e ricomprime le foto sul telefono
│   ├── cifratura_spazio_personale.js  cifratura degli appunti personali
│   ├── spazio_personale.js         logica della vista "Il mio spazio"
│   ├── pagina_bacheca.js           navigazione, profilo, griglia/elenco, nuovo post
│   ├── pagina_amministrazione.js   logica dell'area educatori
│   ├── installazione_app.js        installazione come app sul telefono
│   ├── servizio_offline.js         service worker (apertura senza connessione)
│   ├── manifest_bacheca.webmanifest   dati dell'app "Bacheca"
│   └── manifest_educatori.webmanifest dati dell'app "Educatori"
├── strumenti/
│   └── genera_icone_app.py         crea le icone delle app dal logo
├── database/
│   ├── 00_elimina_versione_precedente.sql  solo se era stata installata la prima versione
│   ├── 01_crea_tabelle_e_regole.sql   tabelle, permessi, contenitore foto e funzioni
│   └── 02_immagini_spazi_personali.sql  foto cifrate negli spazi personali
├── docs/
│   ├── guida_ragazzi.md            istruzioni brevi da dare ai ragazzi
│   └── guida_installazione_app.md  come aggiungere la bacheca alla schermata Home (iPhone e Android)
└── .github/workflows/
    └── mantieni_attivo_database.yml   evita la pausa del database gratuito
```

## Installazione

### 1. Creare il database su Supabase

1. Registrarsi su https://supabase.com e creare un nuovo progetto.
2. Come regione scegliere un data center nell'Unione Europea (ad esempio Francoforte).
3. Annotare la password del database in un posto sicuro (non serve alla pagina, serve per la gestione).

### 2. Creare tabelle e permessi

1. Nel pannello del progetto aprire **SQL Editor**.
2. Solo se in precedenza era stata eseguita la prima versione del progetto: incollare ed eseguire `database/00_elimina_versione_precedente.sql` (cancella i dati della prima versione). Le foto eventualmente caricate restano in Storage e vanno eliminate a mano.
3. Incollare tutto il contenuto di `database/01_crea_tabelle_e_regole.sql` e premere **Run**. Non devono comparire errori.
4. Allo stesso modo eseguire `database/02_immagini_spazi_personali.sql` (foto negli spazi personali). Va eseguito anche nei progetti già in uso: non cancella dati e si può rieseguire.
5. In **Storage** deve comparire il contenitore pubblico `foto_post`.

### 3. Account degli educatori (passo obbligatorio per la sicurezza)

Il database considera "educatore" chiunque abbia fatto login. Per questo:

1. In **Authentication**, nelle impostazioni dei metodi di accesso, **disattivare la registrazione di nuovi utenti** (opzione simile a "Allow new users to sign up"). I nomi delle voci nel pannello possono cambiare leggermente nel tempo.
2. In **Authentication > Users** usare **Add user** (poi "Create new user") per creare un account per ogni educatore, con **Auto Confirm User** attivo.

Gli educatori entrano con **nome e password personale**, senza email. Supabase però richiede un'email: la pagina la ricava dal nome, quindi l'account va creato con l'email costruita così:

- nome in minuscolo, senza accenti, spazi sostituiti da un punto, seguito da `@educatori.oratorio.invalid` (valore di `dominioAccessoEducatori` in `config/configurazione.js`);
- esempi: "Maria Rossi" → `maria.rossi@educatori.oratorio.invalid`; "Don Luca" → `don.luca@educatori.oratorio.invalid`; "Niccolò" → `niccolo@educatori.oratorio.invalid`.

Comunicare a ogni educatore il nome esatto da scrivere (maiuscole e accenti non contano) e la sua password. Le password vanno scelte diverse dal nome e di almeno 8 caratteri: chi conosce nome e password può gestire tutta la bacheca. Supabase non invia email a questi indirizzi (il dominio `.invalid` non esiste per definizione), quindi una password dimenticata si cambia dal pannello: **Authentication > Users**, menu della riga dell'educatore. Gli account già creati con un'email vera continuano a funzionare scrivendo l'email al posto del nome.

Se il pannello rifiutasse l'indirizzo come non valido, cambiare `dominioAccessoEducatori` con un altro dominio (ad esempio quello del sito della parrocchia) e usare quello nella creazione degli account.

Se la registrazione resta attiva, chiunque potrebbe crearsi un account e cancellare post o contenuti.

### 4. Collegare la pagina al database

1. Nel pannello aprire **Project Settings > API** (o **API Keys**).
2. Copiare l'indirizzo del progetto (`https://....supabase.co`) e la chiave **pubblica** ("publishable" o "anon").
3. Inserirli in `config/configurazione.js`, insieme al nome del gruppo.

Non usare mai la chiave "secret" o "service_role": darebbe accesso completo al database.

### 5. Logo e marchio dell'oratorio

Nella cartella `risorse_grafiche/` ci sono due file vettoriali (SVG):

- `marchio_oratorio.svg`: il simbolo. Compare nel cerchio del profilo, come immagine dei post degli educatori, nell'area educatori, come icona della scheda del browser e nelle icone delle app (passo 10).
- `logo_oratorio.svg`: la scritta completa. Compare nella barra in alto della bacheca al posto di simbolo + nome.

Per sostituirli basta salvare i nuovi file con lo stesso nome (oppure cambiare `percorsoLogo` e `percorsoLogoEsteso` in `config/configurazione.js`; con `percorsoLogoEsteso: ""` in alto tornano simbolo e nome del gruppo). Se il simbolo manca, viene usato `logo_segnaposto.svg`. Dopo ogni cambio del simbolo, rigenerare le icone delle app con `python3 strumenti/genera_icone_app.py`.

### 6. Provare in locale (facoltativo)

Dalla cartella principale del progetto:

```
python3 -m http.server 8000
```

Poi aprire http://localhost:8000 nel browser. L'area educatori è su http://localhost:8000/src/amministrazione.html.

### 7. Pubblicare il sito con GitHub Pages

1. Creare un repository su GitHub e caricare tutti i file del progetto (cartella `.github` compresa).
2. In **Settings > Pages** scegliere "Deploy from a branch", ramo `main`, cartella `/ (root)`.
3. Dopo qualche minuto il sito è raggiungibile su `https://NOME-UTENTE.github.io/NOME-REPOSITORY/`.

La chiave pubblica nel codice è visibile a chiunque: è previsto così. I dati sono protetti dalle regole del file SQL, non dalla segretezza della chiave.

### 8. Evitare la pausa del database

Il piano gratuito di Supabase mette in pausa il progetto dopo una settimana senza attività (per esempio durante le vacanze). Un progetto in pausa si riattiva dal pannello Supabase. Per evitarlo:

1. Nel repository GitHub aprire **Settings > Secrets and variables > Actions**.
2. Aggiungere i secret `INDIRIZZO_SUPABASE` e `CHIAVE_PUBBLICA_SUPABASE` (stessi valori del passo 4).
3. In **Actions** verificare che "Mantieni attivo il database" sia abilitato; si può lanciare a mano con **Run workflow** per provarlo.

GitHub può disattivare i flussi programmati nei repository senza modifiche da molto tempo: in quel caso basta riattivarlo dalla scheda **Actions**.

### 9. Creare il QR code

Generare un QR code che punti all'indirizzo del sito (passo 7) con un qualsiasi generatore gratuito. Prima di stamparlo, verificare che funzioni con più telefoni.

### 10. Installare l'app sul telefono (facoltativo)

Bacheca e area educatori si possono aggiungere alla schermata del telefono come app separate (Progressive Web App): si aprono a schermo intero, con la propria icona, senza barra del browser. Non serve passare da Play Store o App Store. Funziona solo con il sito pubblicato in HTTPS (GitHub Pages lo è).

- **Android (Chrome):** aprire la pagina, poi menu ⋮ > "Installa app" (o "Aggiungi a schermata Home"). Nella bacheca compare anche un pulsante "Installa" in alto a destra; nell'area educatori un riquadro con il pulsante "Installa l'app".
- **iPhone (Safari):** aprire la pagina, poi pulsante Condividi > "Aggiungi alla schermata Home".

Per gli educatori: chi installa la bacheca entra nell'area riservata con **Accedi come edu**. In alternativa si può installare un'app separata "Educatori" partendo dall'area educatori (dopo aver premuto Accedi come edu): la sua icona apre direttamente l'area riservata. Su iPhone l'app installata non condivide il login con Safari: bisogna accedere una volta dentro l'app, poi l'accesso resta memorizzato.

File coinvolti:

- `src/manifest_bacheca.webmanifest` e `src/manifest_educatori.webmanifest`: nome, icona e colori delle due app (i nomi mostrati sotto l'icona si cambiano qui, campi `name` e `short_name`).
- `src/servizio_offline.js`: scarica sempre i file aggiornati; se manca la connessione apre l'ultima versione salvata (senza post nuovi). Se lo si modifica, aumentare `VERSIONE_CACHE`.
- `src/installazione_app.js`: pulsanti e istruzioni di installazione.
- `risorse_grafiche/icone/`: icone delle app. **Dopo aver aggiunto o cambiato il logo** (passo 5) rigenerarle con `python3 strumenti/genera_icone_app.py` (richiede Pillow, `pip install Pillow`, e per leggere l'SVG uno tra `pip install cairosvg`, `rsvg-convert` o ImageMagick). Le icone degli educatori hanno l'etichetta "EDU".

Chi ha già installato l'app vede le icone nuove solo dopo averla rimossa e reinstallata (dipende dal telefono).

## Uso

### Educatori

- Nella bacheca premere **Accedi come edu** in alto a destra ed entrare con nome e password personale (l'indirizzo diretto è `.../src/amministrazione.html`).
- **Impostazioni**: la casella "Le foto dei ragazzi compaiono solo dopo l'approvazione" fa sì che i post con foto restino nascosti finché un educatore non li approva. Le sole frasi vengono comunque pubblicate subito.
- **Foto da approvare**: approvare o eliminare.
- **Pubblica un post come educatori**: foto, frase o entrambe; compaiono con il logo e l'etichetta "Educatori".
- **Descrizione del profilo e link**: testi sotto il logo; aggiungere testo, link facoltativo e ordine (i numeri più bassi compaiono in alto). Per modificare un contenuto: eliminarlo e riscriverlo.
- **Post pubblicati**: eliminare quelli non adatti (viene eliminata anche la foto).

### Ragazzi

Vedi `docs/guida_ragazzi.md`, da stampare o condividere insieme al QR code.

## Come sono protetti gli spazi personali

- La password non lascia mai il telefono. Da essa il telefono ricava due chiavi indipendenti (PBKDF2-SHA256): una cifra gli appunti (AES-GCM), l'altra serve solo a dimostrare al database di avere diritto a leggere e salvare quello spazio.
- Il database conserva solo il testo cifrato e l'hash bcrypt della seconda chiave. Chi ha accesso al pannello Supabase vede testo illeggibile.
- Le foto degli appunti sono ridotte (lato lungo massimo 1280 pixel, senza metadati GPS) e cifrate sul telefono con la stessa chiave degli appunti, poi salvate nella tabella `immagini_spazi_personali` (non nello Storage pubblico). Quali foto appartengono a quale appunto è scritto solo dentro gli appunti cifrati. Al massimo 20 foto per spazio, circa 700 kB l'una.
- Una foto viene caricata appena scelta, ma resta nell'appunto solo premendo **Salva**: al salvataggio il database elimina le foto tolte o mai salvate. Eliminando uno spazio dal SQL Editor si eliminano anche le sue foto.
- Spazio occupato: ogni foto cifrata pesa indicativamente 150–950 kB nel database (piano gratuito: 500 MB in tutto). Con molti ragazzi che usano tutte le 20 foto conviene ridurre `numeroMassimoImmaginiSpazio` (in `config/configurazione.js` e nel file SQL 02). Lo spazio usato si vede nel pannello Supabase (Database > Usage o Reports).
- **Una password dimenticata non si può recuperare.** Lo spazio resta inaccessibile; un educatore può eliminarlo dal SQL Editor, così il nome torna libero:
  ```sql
  delete from public.spazi_personali where nome_spazio = 'nome-da-liberare';
  ```

## Foto

- Sul telefono la foto viene ridotta (lato lungo massimo 1440 pixel) e ricompressa in JPEG prima dell'invio. La ricompressione elimina i metadati, compresa l'eventuale posizione GPS.
- Il database accetta solo file JPEG fino a 3 MB con nome casuale, nel contenitore `foto_post`.
- Il contenitore è pubblico in lettura: chi conosce l'indirizzo esatto di una foto può aprirla, anche se il post è in attesa di approvazione. Gli indirizzi sono casuali e non elencabili.
- Il piano gratuito di Supabase include 1 GB per i file: con foto ricompresse (indicativamente qualche centinaio di kB l'una) bastano per alcune migliaia di foto.

## Limiti noti

- Chiunque può verificare se un nome di spazio esiste già. Conviene usare un soprannome, non nome e cognome.
- Non c'è un limite ai tentativi di password. Il calcolo lento delle chiavi rende i tentativi costosi, ma una password banale resta indovinabile: consigliare password di almeno 8 caratteri non ovvie.
- Non c'è protezione contro chi pubblica molti post di seguito: gli educatori possono eliminarli dall'area educatori.
- Chiunque abbia il link può pubblicare foto. Con ragazzi minorenni si consiglia di attivare l'approvazione delle foto e di stabilire regole chiare (ad esempio: niente foto di altre persone senza il loro consenso).
- I post non si aggiornano da soli: per vedere quelli nuovi si ricarica la pagina.
- Piano gratuito Supabase: limiti di spazio e traffico più che sufficienti per un gruppo, nessun backup automatico, pausa dopo una settimana di inattività (vedi passo 8).

## Privacy

La pagina non chiede nome, email o altri dati personali ai ragazzi. I post pubblici possono però contenere ciò che i ragazzi stessi scrivono e fotografano, comprese immagini di persone riconoscibili. Con ragazzi minorenni è opportuno concordare con l'ente responsabile del gruppo una breve informativa e le regole d'uso della bacheca. Queste indicazioni non sostituiscono una consulenza legale.

## Personalizzazione

- Testi: `config/testi_interfaccia.js`. Per un'altra lingua, copiare il blocco `it`, tradurlo e impostare `linguaInterfaccia` in `config/configurazione.js`.
- Colori e caratteri: variabili all'inizio di `src/stile_comune.css` (tema chiaro e scuro). Lo stile attuale usa il carattere Poppins (caricato da Google Fonts in `src/index.html` e `src/amministrazione.html`), i verdi della palette dell'oratorio (`--colore-marchio` #00c10c per anelli e decorazioni, `--colore-accento` #008d00 per i pulsanti con testo bianco, `--colore-testo-accento` #006e00 per testi e link), schede bianche con ombra e pulsanti a pillola. La versione grafica precedente è conservata in `backup_stile_precedente/`: per tornare indietro basta ricopiare quei tre file in `src/`. I due colori del cerchio attorno al logo sono `--colore-anello-logo-1` e `--colore-anello-logo-2`: si possono adattare ai colori del logo.
- Nome mostrato in alto: `nomeGruppo` in `config/configurazione.js`.
- Limiti di lunghezza: `config/configurazione.js`. Se si cambiano, aggiornare anche i controlli `check` nel file SQL.
