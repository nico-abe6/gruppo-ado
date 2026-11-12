-- =============================================================================
-- 01_crea_tabelle_e_regole.sql
--
-- Crea le tabelle, le regole di accesso (Row Level Security) e le funzioni
-- della Bacheca QR. Da eseguire UNA volta nel "SQL Editor" del progetto
-- Supabase, dopo averlo creato.
--
-- Ruoli Supabase usati:
--   anon          = chiunque apra la pagina (ragazzi, nessun login)
--   authenticated = educatori che hanno fatto login nell'area educatori
--
-- ATTENZIONE: il ruolo "authenticated" e' considerato "educatore". Per questo
-- nel pannello Supabase va DISATTIVATA la registrazione libera di nuovi utenti
-- (vedi README.md, passo 3). Altrimenti chiunque potrebbe registrarsi e
-- ottenere i permessi da educatore.
--
-- I limiti di lunghezza e di dimensione delle foto qui sotto devono
-- coincidere con quelli in config/configurazione.js.
--
-- Se nel progetto era gia' stata eseguita la versione precedente di questo
-- script, eseguire prima 00_elimina_versione_precedente.sql.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;


-- -----------------------------------------------------------------------------
-- 1. Contenuti degli educatori (frasi e link visibili a tutti)
-- -----------------------------------------------------------------------------
create table if not exists public.contenuti_educatori (
    id              bigint generated always as identity primary key,
    testo           text not null check (char_length(btrim(testo)) between 1 and 1000),
    indirizzo_link  text check (indirizzo_link is null or indirizzo_link ~* '^https?://'),
    ordine          integer not null default 0,
    creato_il       timestamptz not null default now()
);

alter table public.contenuti_educatori enable row level security;

revoke all on public.contenuti_educatori from anon, authenticated;
grant select on public.contenuti_educatori to anon, authenticated;
grant insert, update, delete on public.contenuti_educatori to authenticated;

create policy "contenuti_educatori_lettura_pubblica"
    on public.contenuti_educatori for select
    to anon, authenticated
    using (true);

create policy "contenuti_educatori_gestione_educatori"
    on public.contenuti_educatori for all
    to authenticated
    using (true)
    with check (true);


-- -----------------------------------------------------------------------------
-- 2. Impostazioni della bacheca (una sola riga)
-- -----------------------------------------------------------------------------
create table if not exists public.impostazioni_bacheca (
    id                            integer primary key default 1 check (id = 1),
    foto_richiedono_approvazione  boolean not null default false
);

insert into public.impostazioni_bacheca (id) values (1) on conflict (id) do nothing;

alter table public.impostazioni_bacheca enable row level security;

revoke all on public.impostazioni_bacheca from anon, authenticated;
grant select on public.impostazioni_bacheca to anon, authenticated;
grant update (foto_richiedono_approvazione) on public.impostazioni_bacheca to authenticated;

create policy "impostazioni_lettura_pubblica"
    on public.impostazioni_bacheca for select
    to anon, authenticated
    using (true);

create policy "impostazioni_modifica_educatori"
    on public.impostazioni_bacheca for update
    to authenticated
    using (true)
    with check (true);


-- -----------------------------------------------------------------------------
-- 3. Post della bacheca: solo testo, solo foto, o entrambi.
--    Scritti dai ragazzi (anche anonimi) o dagli educatori (da_educatori).
--    percorso_foto e' il nome del file nel contenitore "foto_post".
-- -----------------------------------------------------------------------------
create table if not exists public.post_bacheca (
    id             bigint generated always as identity primary key,
    testo          text check (testo is null or char_length(btrim(testo)) between 1 and 500),
    firma          text check (firma is null or char_length(btrim(firma)) between 1 and 40),
    percorso_foto  text check (percorso_foto is null or percorso_foto ~ '^[0-9a-f-]{36}\.jpg$'),
    da_educatori   boolean not null default false,
    approvato      boolean not null default true,
    creato_il      timestamptz not null default now(),
    constraint post_bacheca_testo_o_foto check (testo is not null or percorso_foto is not null)
);

create index if not exists post_bacheca_per_data on public.post_bacheca (creato_il desc);

alter table public.post_bacheca enable row level security;

-- I ragazzi possono scrivere solo testo, firma e nome della foto.
-- Gli educatori anche il contrassegno da_educatori; possono approvare ed eliminare.
revoke all on public.post_bacheca from anon, authenticated;
grant select on public.post_bacheca to anon, authenticated;
grant insert (testo, firma, percorso_foto) on public.post_bacheca to anon;
grant insert (testo, firma, percorso_foto, da_educatori) on public.post_bacheca to authenticated;
grant update (approvato) on public.post_bacheca to authenticated;
grant delete on public.post_bacheca to authenticated;

create policy "post_lettura_pubblica_solo_approvati"
    on public.post_bacheca for select
    to anon
    using (approvato);

create policy "post_lettura_educatori_tutti"
    on public.post_bacheca for select
    to authenticated
    using (true);

create policy "post_scrittura_pubblica"
    on public.post_bacheca for insert
    to anon, authenticated
    with check (true);

create policy "post_approvazione_educatori"
    on public.post_bacheca for update
    to authenticated
    using (true)
    with check (true);

create policy "post_cancellazione_educatori"
    on public.post_bacheca for delete
    to authenticated
    using (true);

-- Se l'impostazione e' attiva, i post con foto scritti da chi non e'
-- educatore restano nascosti finche' un educatore non li approva.
create or replace function public.imposta_approvazione_nuovo_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.percorso_foto is not null
       and coalesce(auth.jwt() ->> 'role', 'anon') <> 'authenticated'
       and (select foto_richiedono_approvazione from public.impostazioni_bacheca where id = 1) then
        new.approvato := false;
    else
        new.approvato := true;
    end if;
    return new;
end;
$$;

drop trigger if exists post_bacheca_approvazione_iniziale on public.post_bacheca;
create trigger post_bacheca_approvazione_iniziale
    before insert on public.post_bacheca
    for each row execute function public.imposta_approvazione_nuovo_post();


-- -----------------------------------------------------------------------------
-- 4. Contenitore delle foto (Supabase Storage)
--    Pubblico in lettura; accetta solo JPEG fino a 3 MB con nome casuale.
--    Il limite di dimensione deve coincidere con config/configurazione.js.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto_post', 'foto_post', true, 3145728, array['image/jpeg'])
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "foto_post_caricamento_pubblico" on storage.objects;
create policy "foto_post_caricamento_pubblico"
    on storage.objects for insert
    to anon, authenticated
    with check (bucket_id = 'foto_post' and name ~ '^[0-9a-f-]{36}\.jpg$');

drop policy if exists "foto_post_cancellazione_educatori" on storage.objects;
create policy "foto_post_cancellazione_educatori"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'foto_post');

drop policy if exists "foto_post_lettura_educatori" on storage.objects;
create policy "foto_post_lettura_educatori"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'foto_post');


-- -----------------------------------------------------------------------------
-- 5. Spazi personali (appunti privati e cifrati)
--
-- Il testo arriva gia' cifrato dal telefono (AES-GCM, chiave derivata dalla
-- password con PBKDF2). Il database non vede mai la password ne' il testo.
-- Dalla password il telefono ricava anche una "chiave di accesso" separata:
-- il database ne conserva solo l'hash bcrypt e la usa per decidere chi puo'
-- leggere o sovrascrivere uno spazio.
--
-- La tabella non e' accessibile direttamente: si usa solo tramite le
-- funzioni qui sotto.
-- -----------------------------------------------------------------------------
create table if not exists public.spazi_personali (
    nome_spazio           text primary key check (nome_spazio ~ '^[a-z0-9_-]{3,40}$'),
    parametri_derivazione text not null check (char_length(parametri_derivazione) <= 200),
    hash_chiave_accesso   text not null,
    vettore_iniziale      text not null check (char_length(vettore_iniziale) <= 100),
    testo_cifrato         text not null check (char_length(testo_cifrato) <= 300000),
    creato_il             timestamptz not null default now(),
    aggiornato_il         timestamptz not null default now()
);

alter table public.spazi_personali enable row level security;
revoke all on public.spazi_personali from anon, authenticated;
-- Nessuna policy: accesso diretto negato a tutti.


-- Restituisce i parametri pubblici (iterazioni e sale) per derivare le chiavi.
-- Restituisce null se lo spazio non esiste.
create or replace function public.ottieni_parametri_spazio_personale(p_nome_spazio text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
    select parametri_derivazione
    from public.spazi_personali
    where nome_spazio = lower(btrim(p_nome_spazio));
$$;


-- Crea un nuovo spazio. Restituisce false se il nome e' gia' usato.
create or replace function public.crea_spazio_personale(
    p_nome_spazio           text,
    p_parametri_derivazione text,
    p_chiave_accesso        text,
    p_vettore_iniziale      text,
    p_testo_cifrato         text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    righe_inserite integer;
begin
    if char_length(coalesce(p_chiave_accesso, '')) < 32 then
        raise exception 'chiave_accesso_non_valida';
    end if;

    insert into public.spazi_personali
        (nome_spazio, parametri_derivazione, hash_chiave_accesso, vettore_iniziale, testo_cifrato)
    values
        (lower(btrim(p_nome_spazio)), p_parametri_derivazione,
         crypt(p_chiave_accesso, gen_salt('bf', 10)), p_vettore_iniziale, p_testo_cifrato)
    on conflict (nome_spazio) do nothing;

    get diagnostics righe_inserite = row_count;
    return righe_inserite = 1;
end;
$$;


-- Legge uno spazio. Restituisce zero righe se nome o chiave sono sbagliati.
create or replace function public.leggi_spazio_personale(
    p_nome_spazio    text,
    p_chiave_accesso text
)
returns table (vettore_iniziale text, testo_cifrato text, aggiornato_il timestamptz)
language sql
stable
security definer
set search_path = public, extensions
as $$
    select s.vettore_iniziale, s.testo_cifrato, s.aggiornato_il
    from public.spazi_personali s
    where s.nome_spazio = lower(btrim(p_nome_spazio))
      and s.hash_chiave_accesso = crypt(p_chiave_accesso, s.hash_chiave_accesso);
$$;


-- Salva (sovrascrive) uno spazio. Restituisce la nuova data di aggiornamento,
-- oppure null se nome o chiave sono sbagliati.
create or replace function public.salva_spazio_personale(
    p_nome_spazio      text,
    p_chiave_accesso   text,
    p_vettore_iniziale text,
    p_testo_cifrato    text
)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    nuova_data timestamptz;
begin
    update public.spazi_personali s
    set vettore_iniziale = p_vettore_iniziale,
        testo_cifrato    = p_testo_cifrato,
        aggiornato_il    = now()
    where s.nome_spazio = lower(btrim(p_nome_spazio))
      and s.hash_chiave_accesso = crypt(p_chiave_accesso, s.hash_chiave_accesso)
    returning s.aggiornato_il into nuova_data;

    return nuova_data;
end;
$$;


-- Le funzioni sono gli unici punti di accesso agli spazi personali.
revoke all on function public.ottieni_parametri_spazio_personale(text) from public;
revoke all on function public.crea_spazio_personale(text, text, text, text, text) from public;
revoke all on function public.leggi_spazio_personale(text, text) from public;
revoke all on function public.salva_spazio_personale(text, text, text, text) from public;

grant execute on function public.ottieni_parametri_spazio_personale(text) to anon, authenticated;
grant execute on function public.crea_spazio_personale(text, text, text, text, text) to anon, authenticated;
grant execute on function public.leggi_spazio_personale(text, text) to anon, authenticated;
grant execute on function public.salva_spazio_personale(text, text, text, text) to anon, authenticated;
