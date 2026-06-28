-- =====================================================================
--  Annales & corrigés partagés (bibliothèque collaborative)
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.annales (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  auteur     text,
  titre      text not null,
  type       text,                    -- sujet | corrige | fiche | autre
  matiere    text,
  url        text not null,
  created_at timestamptz not null default now()
);
create index if not exists annales_idx on public.annales (created_at desc);

alter table public.annales enable row level security;
create policy "annales_select" on public.annales for select to authenticated using (true);
create policy "annales_insert" on public.annales for insert to authenticated with check (user_id = auth.uid());
create policy "annales_delete" on public.annales for delete to authenticated
  using (user_id = auth.uid() or (select role from public.profils where id = auth.uid()) = 'admin');
