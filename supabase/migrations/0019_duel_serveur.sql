-- =====================================================================
--  Durcissement Duel : correction côté serveur (anti-triche).
--  Les bonnes réponses ne sont plus exposées au client ; le score est
--  calculé et écrit uniquement par le serveur (service_role).
--  À exécuter dans Supabase APRÈS 0018 : SQL Editor > coller > Run
-- =====================================================================

-- Solutions cachées du client : AUCUNE policy => seul le service_role y accède.
create table if not exists public.match_solutions (
  match_id  uuid primary key references public.matchs(id) on delete cascade,
  solutions jsonb not null            -- [[indices corrects q0], [q1], …]
);
alter table public.match_solutions enable row level security;

-- Une réponse par (match, joueur, question) : empêche tout double comptage,
-- et le score agrégé du joueur en découle. Écriture via service_role uniquement.
create table if not exists public.match_reponses (
  match_id   uuid not null references public.matchs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  q_index    int  not null,
  juste      boolean not null default false,
  points     int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id, q_index)
);
alter table public.match_reponses enable row level security;
-- Le joueur peut relire SES réponses (débrief) ; il n'écrit jamais directement.
create policy "mr_select" on public.match_reponses for select to authenticated using (user_id = auth.uid());

-- Le client ne met PLUS à jour son score : seul le serveur (service_role) le fait.
drop policy if exists "mj_update" on public.match_joueurs;
