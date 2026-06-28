-- =====================================================================
--  Astuces / mnémotechniques partagées sous les fiches (collaboratif)
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.astuces (
  id         uuid primary key default gen_random_uuid(),
  fiche_id   uuid not null references public.fiches(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  auteur     text,
  texte      text not null,
  created_at timestamptz not null default now()
);
create index if not exists astuces_fiche_idx on public.astuces (fiche_id, created_at);

alter table public.astuces enable row level security;
create policy "astuces_select" on public.astuces for select to authenticated using (true);
create policy "astuces_insert" on public.astuces for insert to authenticated with check (user_id = auth.uid());
create policy "astuces_delete" on public.astuces for delete to authenticated
  using (user_id = auth.uid() or (select role from public.profils where id = auth.uid()) = 'admin');
