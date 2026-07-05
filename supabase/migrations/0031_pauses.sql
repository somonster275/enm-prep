-- =====================================================================
--  Mode vacances : périodes de pause qui protègent la série (les flammes)
--  Un jour couvert par une pause n'interrompt pas la série même sans activité.
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.pauses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  debut      date not null,
  fin        date not null,
  created_at timestamptz not null default now()
);

create index if not exists pauses_user_idx on public.pauses (user_id, debut);

-- Chaque utilisateur ne voit et ne gère que ses propres pauses.
alter table public.pauses enable row level security;
create policy "pauses_select" on public.pauses for select to authenticated using (user_id = auth.uid());
create policy "pauses_insert" on public.pauses for insert to authenticated with check (user_id = auth.uid());
create policy "pauses_update" on public.pauses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pauses_delete" on public.pauses for delete to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
