-- =====================================================================
--  Médias par lien (YouTube non répertorié, audio…) : on ajoute une
--  description destinée à l'étudiant. Plus d'hébergement de fichiers.
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

alter table public.medias add column if not exists description text;
