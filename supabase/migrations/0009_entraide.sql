-- =====================================================================
--  Entraide : annuaire collaboratif des étudiants « référents » par matière
--  Chaque étudiant publie (s'il le souhaite) ses coordonnées et les matières
--  sur lesquelles il peut aider. Visible par tous les étudiants connectés.
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.entraide (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prenom     text,
  nom        text,
  contact    text not null,          -- téléphone et/ou email, au choix de l'étudiant
  matieres   text not null,          -- matières de spécialité (texte libre)
  message    text,                   -- mot d'intro facultatif
  updated_at timestamptz not null default now()
);

create index if not exists entraide_maj_idx on public.entraide (updated_at desc);

alter table public.entraide enable row level security;

-- Annuaire visible par tous les étudiants connectés.
create policy "entraide_select_all" on public.entraide
  for select to authenticated using (true);
-- Chacun ne gère que SA propre fiche d'entraide.
create policy "entraide_insert_self" on public.entraide
  for insert to authenticated with check (user_id = auth.uid());
create policy "entraide_update_self" on public.entraide
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "entraide_delete_self" on public.entraide
  for delete to authenticated using (user_id = auth.uid());
