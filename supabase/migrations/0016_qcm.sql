-- =====================================================================
--  QCM interactifs (auto-corrigés)
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.qcm (
  id         uuid primary key default gen_random_uuid(),
  titre      text not null,
  matiere    text,
  created_at timestamptz not null default now()
);

create table if not exists public.qcm_questions (
  id          uuid primary key default gen_random_uuid(),
  qcm_id      uuid not null references public.qcm(id) on delete cascade,
  enonce      text not null,
  options     jsonb not null default '[]',     -- [{ "t": "texte", "c": true|false }]
  explication text,
  ordre       int not null default 0
);
create index if not exists qcm_q_idx on public.qcm_questions (qcm_id, ordre);

create table if not exists public.qcm_resultats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  qcm_id     uuid not null references public.qcm(id) on delete cascade,
  score      int not null,
  total      int not null,
  created_at timestamptz not null default now()
);
create index if not exists qcm_res_idx on public.qcm_resultats (user_id, created_at desc);

alter table public.qcm enable row level security;
alter table public.qcm_questions enable row level security;
alter table public.qcm_resultats enable row level security;

-- QCM + questions : lecture par tous les étudiants ; création/suppression par
-- l'admin via le serveur (service_role) ou la policy de suppression admin.
create policy "qcm_select" on public.qcm for select to authenticated using (true);
create policy "qcm_delete" on public.qcm for delete to authenticated
  using ((select role from public.profils where id = auth.uid()) = 'admin');
create policy "qcmq_select" on public.qcm_questions for select to authenticated using (true);

-- Résultats : chacun gère les siens.
create policy "qcmr_select" on public.qcm_resultats for select to authenticated using (user_id = auth.uid());
create policy "qcmr_insert" on public.qcm_resultats for insert to authenticated with check (user_id = auth.uid());
