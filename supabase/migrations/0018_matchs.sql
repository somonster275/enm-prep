-- =====================================================================
--  Duel / Match en temps réel : des étudiants se testent ensemble sur
--  un même paquet (QCM existants + fiches converties), puis comparent
--  leurs résultats. Chrono par question, classement live.
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.matchs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                -- code court à partager (ex. « AB12CD »)
  hote_id     uuid not null references auth.users(id) on delete cascade,
  titre       text,                                -- libellé indicatif (matière / QCM)
  statut      text not null default 'attente',     -- 'attente' | 'en_cours' | 'termine'
  deck        jsonb not null default '[]',         -- paquet figé : [{ enonce, options:[{t,c}], cat }]
  secondes_par_question int not null default 20,
  started_at  timestamptz,                         -- top de départ commun (chrono synchronisé)
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists matchs_code_idx on public.matchs (code);
create index if not exists matchs_statut_idx on public.matchs (statut, created_at desc);

create table if not exists public.match_joueurs (
  match_id  uuid not null references public.matchs(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  pseudo    text not null,
  score     int  not null default 0,
  repondu   int  not null default 0,               -- nb de questions auxquelles il a répondu
  justes    int  not null default 0,               -- nb de bonnes réponses
  termine   boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index if not exists match_joueurs_idx on public.match_joueurs (match_id);

alter table public.matchs        enable row level security;
alter table public.match_joueurs enable row level security;

-- Lecture par tous les étudiants connectés (salon visible des participants).
create policy "matchs_select" on public.matchs for select to authenticated using (true);
-- Création : on est l'hôte du match qu'on crée.
create policy "matchs_insert" on public.matchs for insert to authenticated with check (hote_id = auth.uid());
-- Seul l'hôte fait évoluer le match (lancer / terminer).
create policy "matchs_update" on public.matchs for update to authenticated
  using (hote_id = auth.uid()) with check (hote_id = auth.uid());
create policy "matchs_delete" on public.matchs for delete to authenticated using (hote_id = auth.uid());

-- Lecture de tous les joueurs d'un match (classement live).
create policy "mj_select" on public.match_joueurs for select to authenticated using (true);
-- Chacun rejoint pour lui-même et ne met à jour QUE sa propre ligne (son score).
create policy "mj_insert" on public.match_joueurs for insert to authenticated with check (user_id = auth.uid());
create policy "mj_update" on public.match_joueurs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mj_delete" on public.match_joueurs for delete to authenticated using (user_id = auth.uid());

-- Force le pseudo affiché au vrai nom du profil (anti-usurpation, cf. 0017).
create or replace function public.forcer_pseudo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.pseudo  := public.nom_affichage(auth.uid());
  return new;
end;
$$;
drop trigger if exists trg_pseudo on public.match_joueurs;
create trigger trg_pseudo before insert on public.match_joueurs
  for each row execute function public.forcer_pseudo();

-- Realtime : pousser les changements aux clients abonnés (lobby + scoreboard).
alter publication supabase_realtime add table public.matchs;
alter publication supabase_realtime add table public.match_joueurs;
