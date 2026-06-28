-- =====================================================================
--  Historique du Coach IA persisté en base (au lieu du localStorage)
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.coach_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null,            -- 'user' | 'assistant'
  contenu    text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_msg_idx on public.coach_messages (user_id, created_at);

alter table public.coach_messages enable row level security;
create policy "coach_select" on public.coach_messages for select to authenticated using (user_id = auth.uid());
create policy "coach_insert" on public.coach_messages for insert to authenticated with check (user_id = auth.uid());
create policy "coach_delete" on public.coach_messages for delete to authenticated using (user_id = auth.uid());
