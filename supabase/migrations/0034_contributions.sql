-- =====================================================================
--  Contributions étudiantes : proposer une fiche ou un QCM → file de
--  modération. L'admin approuve (le contenu est alors créé pour tous) ou
--  refuse. Rend la promesse « collaborative » réelle (co-production modérée).
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.contributions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,                    -- 'fiche' | 'qcm'
  statut     text not null default 'nouveau',  -- nouveau | approuve | refuse
  titre      text,                             -- libellé lisible (matière › chapitre, ou titre du QCM)
  matiere    text,                             -- matière (QCM)
  espace_id  uuid,                             -- cible d'insertion (fiche)
  module_id  uuid,                             -- cible d'insertion (fiche)
  payload    jsonb not null,                   -- contenu proposé (voir la route serveur)
  created_at timestamptz not null default now()
);

create index if not exists contributions_statut_idx on public.contributions (statut, created_at desc);
create index if not exists contributions_user_idx   on public.contributions (user_id, created_at desc);

-- L'étudiant crée ses propositions et peut relire les siennes (suivi du statut).
-- La modération (lecture globale + approbation) passe par une route serveur en service_role.
alter table public.contributions enable row level security;
create policy "contrib_insert" on public.contributions
  for insert to authenticated with check (user_id = auth.uid());
create policy "contrib_select_self" on public.contributions
  for select to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
