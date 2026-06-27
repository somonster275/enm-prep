-- =====================================================================
--  Identité de l'étudiant : prénom + nom sur le profil
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

alter table public.profils add column if not exists nom    text;
alter table public.profils add column if not exists prenom text;
