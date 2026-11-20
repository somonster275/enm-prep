-- 0037 — Verrouillage de la table profils + fiches/modules réservés aux connectés.
--
-- FAILLE CORRIGÉE : la policy « profil_own » (ALL, using auth.uid() = id, sans with_check)
-- laissait chaque utilisateur modifier SA ligne de profils, y compris la colonne `role`.
-- Un étudiant pouvait donc se passer admin via l'API REST Supabase (clé anon publique).
--
-- Après cette migration :
--   - lecture : chacun lit uniquement son profil ;
--   - création : uniquement son propre profil, et seulement avec le rôle « lecteur » ;
--   - aucune modification/suppression côté client : nom/prénom passent par /api/compte/profil,
--     les rôles par /api/admin/utilisateurs (service_role, réservé aux admins).
-- Ré-exécutable sans erreur.

alter table public.profils enable row level security;

drop policy if exists "profil_own" on public.profils;

drop policy if exists "profils_select_self" on public.profils;
create policy "profils_select_self" on public.profils
  for select to authenticated using (id = auth.uid());

drop policy if exists "profils_insert_self" on public.profils;
create policy "profils_insert_self" on public.profils
  for insert to authenticated with check (id = auth.uid() and role = 'lecteur');

-- Fiches et modules : lisibles par les utilisateurs CONNECTÉS seulement (les policies
-- fiches_select / modules_select restent). Les policies « public » permettaient de
-- télécharger tout le contenu sans compte, avec la clé anon.
drop policy if exists "lecture_fiches" on public.fiches;
drop policy if exists "lecture_modules" on public.modules;
