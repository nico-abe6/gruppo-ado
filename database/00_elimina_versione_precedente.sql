-- =============================================================================
-- 00_elimina_versione_precedente.sql
--
-- Da eseguire SOLO se nel progetto Supabase era gia' stata eseguita la prima
-- versione dello script (con la tabella post_ragazzi). Elimina tabelle e
-- funzioni della versione precedente, CON TUTTI I LORO DATI.
-- Dopo, eseguire 01_crea_tabelle_e_regole.sql.
-- =============================================================================
drop function if exists public.aggiungi_immagine_spazio_personale(text, text, uuid, text, text);
drop function if exists public.leggi_immagine_spazio_personale(text, text, uuid);
drop function if exists public.pulisci_immagini_spazio_personale(text, text, uuid[]);
drop function if exists public.verifica_chiave_spazio_personale(text, text);
drop table if exists public.immagini_spazi_personali;
drop function if exists public.ottieni_parametri_spazio_personale(text);
drop function if exists public.crea_spazio_personale(text, text, text, text, text);
drop function if exists public.leggi_spazio_personale(text, text);
drop function if exists public.salva_spazio_personale(text, text, text, text);
drop table if exists public.post_ragazzi;
drop table if exists public.spazi_personali;
drop table if exists public.contenuti_educatori;
