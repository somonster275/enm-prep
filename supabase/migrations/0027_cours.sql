-- =====================================================================
--  Cours : supports de cours (PDF / Word) envoyés par le staff et consultés
--  par les étudiants, qui peuvent y laisser des remarques (comme les fiches).
--  À exécuter dans Supabase : SQL Editor > coller > Run
--  ⚠️ Créer aussi un bucket de stockage PUBLIC nommé « cours »
--     (Storage > New bucket > Public).
-- =====================================================================

create table if not exists public.cours (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null,
  description text,
  matiere     text,
  fichier_url text not null,
  fichier_nom text,
  type        text,                 -- 'pdf' | 'doc'
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists cours_idx on public.cours (created_at desc);

alter table public.cours enable row level security;
-- Lecture par tous les étudiants ; gestion réservée à l'admin.
drop policy if exists "cours_select" on public.cours;
drop policy if exists "cours_insert" on public.cours;
drop policy if exists "cours_delete" on public.cours;
create policy "cours_select" on public.cours for select to authenticated using (true);
create policy "cours_insert" on public.cours for insert to authenticated
  with check ((select role from public.profils where id = auth.uid()) = 'admin');
create policy "cours_delete" on public.cours for delete to authenticated
  using ((select role from public.profils where id = auth.uid()) = 'admin');

-- Remarques des étudiants sur un cours (retour à l'administrateur).
create table if not exists public.cours_remarques (
  id         uuid primary key default gen_random_uuid(),
  cours_id   uuid not null references public.cours(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  message    text not null,
  statut     text not null default 'nouveau',   -- nouveau | traite
  created_at timestamptz not null default now()
);
create index if not exists cours_remarques_statut_idx on public.cours_remarques (statut, created_at desc);
create index if not exists cours_remarques_cours_idx  on public.cours_remarques (cours_id);

alter table public.cours_remarques enable row level security;
drop policy if exists "cours_remarques_insert" on public.cours_remarques;
drop policy if exists "cours_remarques_select_self" on public.cours_remarques;
create policy "cours_remarques_insert" on public.cours_remarques
  for insert to authenticated with check (user_id = auth.uid());
create policy "cours_remarques_select_self" on public.cours_remarques
  for select to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
