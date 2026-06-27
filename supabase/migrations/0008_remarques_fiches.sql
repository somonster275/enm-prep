-- =====================================================================
--  Remarques des étudiants sur les fiches (retour à l'administrateur)
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.remarques_fiches (
  id         uuid primary key default gen_random_uuid(),
  fiche_id   uuid not null references public.fiches(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  message    text not null,
  statut     text not null default 'nouveau',   -- nouveau | traite
  created_at timestamptz not null default now()
);

create index if not exists remarques_statut_idx on public.remarques_fiches (statut, created_at desc);
create index if not exists remarques_fiche_idx  on public.remarques_fiches (fiche_id);

alter table public.remarques_fiches enable row level security;

-- L'étudiant crée ses propres remarques et peut relire les siennes.
-- (La lecture/traitement par l'admin passe par une route serveur en service_role.)
create policy "remarques_insert" on public.remarques_fiches
  for insert to authenticated with check (user_id = auth.uid());
create policy "remarques_select_self" on public.remarques_fiches
  for select to authenticated using (user_id = auth.uid());
