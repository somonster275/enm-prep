-- =====================================================================
--  Favoris : fiches « étoilées » par l'étudiant
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.favoris (
  user_id    uuid not null references auth.users(id) on delete cascade,
  fiche_id   uuid not null references public.fiches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, fiche_id)
);

alter table public.favoris enable row level security;
create policy "favoris_select" on public.favoris for select to authenticated using (user_id = auth.uid());
create policy "favoris_insert" on public.favoris for insert to authenticated with check (user_id = auth.uid());
create policy "favoris_delete" on public.favoris for delete to authenticated using (user_id = auth.uid());
