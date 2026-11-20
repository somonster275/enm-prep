-- 0047 — Index en double repérés dans l'export du schéma (supabase/schema.sql). Ré-exécutable.
--  - activite_jours_user_jour_uniq (0043) : la clé primaire (utilisateur_id, jour) existait déjà,
--    elle garantit l'unicité et sert à `on conflict` (les doublons craints ne pouvaient pas exister).
--  - cours_chunks_fts_idx (0044) : identique à cours_chunks_to_tsvector_idx déjà présent.
-- Chaque index en trop ralentit les écritures (import de documents) sans rien accélérer.
drop index if exists public.activite_jours_user_jour_uniq;
drop index if exists public.cours_chunks_fts_idx;
