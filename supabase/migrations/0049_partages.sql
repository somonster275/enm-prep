-- =====================================================================
--  Partage d'une copie « Mon espace » par lien.
--  Le partage est un instantané (paquet JSON) pris au moment du partage ;
--  « Mettre à jour le partage » le remplace. L'id sert de jeton du lien.
--  Lecture par lien uniquement, via lire_partage() : personne ne peut lister
--  les partages des autres.
--  À exécuter dans Supabase : SQL Editor > coller > Run (ré-exécutable).
-- =====================================================================

create table if not exists public.partages (
  id              uuid primary key default gen_random_uuid(),
  perso_module_id uuid not null unique references public.perso_modules(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contenu         jsonb not null,
  created_at      timestamptz not null default now()
);

alter table public.partages enable row level security;
drop policy if exists "partages_own" on public.partages;
create policy "partages_own" on public.partages for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.perso_modules m where m.id = perso_module_id and m.user_id = auth.uid()));

create or replace function public.lire_partage(p_id uuid) returns jsonb
  language sql stable security definer set search_path = public
as $$ select contenu from public.partages where id = p_id $$;
revoke all on function public.lire_partage(uuid) from public, anon;
grant execute on function public.lire_partage(uuid) to authenticated;

notify pgrst, 'reload schema';
