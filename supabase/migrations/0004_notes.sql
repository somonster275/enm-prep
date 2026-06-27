-- =====================================================================
--  Notes / Tâches personnelles de l'étudiant (pense-bête)
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  contenu    text not null,
  fait       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id, fait, created_at desc);

-- Chaque utilisateur ne voit et ne gère que ses propres notes.
alter table public.notes enable row level security;
create policy "notes_select" on public.notes for select to authenticated using (user_id = auth.uid());
create policy "notes_insert" on public.notes for insert to authenticated with check (user_id = auth.uid());
create policy "notes_update" on public.notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes_delete" on public.notes for delete to authenticated using (user_id = auth.uid());
