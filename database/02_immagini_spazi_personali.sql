-- =============================================================================
-- 02_immagini_spazi_personali.sql
--
-- Aggiunge le immagini agli spazi personali. Da eseguire nel "SQL Editor"
-- di Supabase DOPO 01_crea_tabelle_e_regole.sql, sia nelle installazioni
-- nuove sia in quelle gia' in uso (non cancella dati; si puo' rieseguire).
--
-- Come per gli appunti, ogni immagine arriva gia' cifrata dal telefono
-- (AES-GCM, stessa chiave degli appunti). Il database non vede mai la foto.
-- Quali immagini appartengono a quale appunto e' scritto solo dentro gli
-- appunti cifrati: il database conosce soltanto lo spazio a cui appartengono.
--
-- Limiti (devono coincidere con config/configurazione.js):
--   massimo 20 immagini per spazio            (numeroMassimoImmaginiSpazio)
--   massimo 1 000 000 caratteri per immagine  (circa 700 kB di foto JPEG,
--                                              dimensioneMassimaImmagineSpazioByte)
-- =============================================================================

create table if not exists public.immagini_spazi_personali (
    id_immagine       uuid primary key,
    nome_spazio       text not null references public.spazi_personali (nome_spazio) on delete cascade,
    vettore_iniziale  text not null check (char_length(vettore_iniziale) <= 100),
    dati_cifrati      text not null check (char_length(dati_cifrati) <= 1000000),
    creato_il         timestamptz not null default now()
);

create index if not exists immagini_spazi_personali_per_spazio
    on public.immagini_spazi_personali (nome_spazio);

alter table public.immagini_spazi_personali enable row level security;
revoke all on public.immagini_spazi_personali from anon, authenticated;
-- Nessuna policy: accesso diretto negato a tutti, si usa solo tramite le funzioni.


-- Funzione interna: vero se nome e chiave di accesso sono corretti.
create or replace function public.verifica_chiave_spazio_personale(
    p_nome_spazio    text,
    p_chiave_accesso text
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
    select exists (
        select 1 from public.spazi_personali s
        where s.nome_spazio = lower(btrim(p_nome_spazio))
          and s.hash_chiave_accesso = crypt(p_chiave_accesso, s.hash_chiave_accesso)
    );
$$;


-- Aggiunge un'immagine cifrata. Restituisce false se nome o chiave sono
-- sbagliati; errore "limite_immagini_raggiunto" oltre le 20 immagini.
create or replace function public.aggiungi_immagine_spazio_personale(
    p_nome_spazio      text,
    p_chiave_accesso   text,
    p_id_immagine      uuid,
    p_vettore_iniziale text,
    p_dati_cifrati     text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    limite_immagini constant integer := 20;
    nome_normalizzato text := lower(btrim(p_nome_spazio));
begin
    if not public.verifica_chiave_spazio_personale(nome_normalizzato, p_chiave_accesso) then
        return false;
    end if;
    -- Blocca lo spazio per contare le immagini senza conteggi concorrenti.
    perform 1 from public.spazi_personali where nome_spazio = nome_normalizzato for update;
    if (select count(*) from public.immagini_spazi_personali where nome_spazio = nome_normalizzato) >= limite_immagini then
        raise exception 'limite_immagini_raggiunto';
    end if;
    insert into public.immagini_spazi_personali (id_immagine, nome_spazio, vettore_iniziale, dati_cifrati)
    values (p_id_immagine, nome_normalizzato, p_vettore_iniziale, p_dati_cifrati);
    return true;
end;
$$;


-- Legge un'immagine cifrata. Zero righe se nome, chiave o immagine sono sbagliati.
create or replace function public.leggi_immagine_spazio_personale(
    p_nome_spazio    text,
    p_chiave_accesso text,
    p_id_immagine    uuid
)
returns table (vettore_iniziale text, dati_cifrati text)
language sql
stable
security definer
set search_path = public, extensions
as $$
    select i.vettore_iniziale, i.dati_cifrati
    from public.immagini_spazi_personali i
    where i.id_immagine = p_id_immagine
      and i.nome_spazio = lower(btrim(p_nome_spazio))
      and public.verifica_chiave_spazio_personale(p_nome_spazio, p_chiave_accesso);
$$;


-- Elimina le immagini dello spazio che non compaiono in p_id_da_tenere
-- (immagini tolte dagli appunti o caricate e mai salvate).
-- Restituisce il numero di immagini eliminate, null se nome o chiave sono sbagliati.
create or replace function public.pulisci_immagini_spazio_personale(
    p_nome_spazio    text,
    p_chiave_accesso text,
    p_id_da_tenere   uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    eliminate integer;
begin
    if not public.verifica_chiave_spazio_personale(p_nome_spazio, p_chiave_accesso) then
        return null;
    end if;
    delete from public.immagini_spazi_personali i
    where i.nome_spazio = lower(btrim(p_nome_spazio))
      and not (i.id_immagine = any (coalesce(p_id_da_tenere, '{}'::uuid[])));
    get diagnostics eliminate = row_count;
    return eliminate;
end;
$$;


revoke all on function public.verifica_chiave_spazio_personale(text, text) from public, anon, authenticated;
revoke all on function public.aggiungi_immagine_spazio_personale(text, text, uuid, text, text) from public;
revoke all on function public.leggi_immagine_spazio_personale(text, text, uuid) from public;
revoke all on function public.pulisci_immagini_spazio_personale(text, text, uuid[]) from public;

grant execute on function public.aggiungi_immagine_spazio_personale(text, text, uuid, text, text) to anon, authenticated;
grant execute on function public.leggi_immagine_spazio_personale(text, text, uuid) to anon, authenticated;
grant execute on function public.pulisci_immagini_spazio_personale(text, text, uuid[]) to anon, authenticated;
