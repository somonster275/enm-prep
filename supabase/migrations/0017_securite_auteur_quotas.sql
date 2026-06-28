-- =====================================================================
--  Durcissement : nom d'auteur non usurpable + quotas persistants
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Nom d'affichage officiel d'un utilisateur, calculé depuis profils.
--    SECURITY DEFINER : peut lire profils même si le RLS le restreint.
-- ---------------------------------------------------------------------
create or replace function public.nom_affichage(p_user uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(coalesce(prenom, '') || ' ' || coalesce(nom, '')), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Étudiant'
  )
  from public.profils
  where id = p_user
$$;

-- ---------------------------------------------------------------------
-- 2) Trigger BEFORE INSERT : force l'identité (user_id + auteur).
--    Quoi que le client envoie, on impose auth.uid() et le vrai nom.
-- ---------------------------------------------------------------------
create or replace function public.forcer_auteur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.auteur  := public.nom_affichage(auth.uid());
  return new;
end;
$$;

drop trigger if exists trg_auteur on public.forum_questions;
create trigger trg_auteur before insert on public.forum_questions
  for each row execute function public.forcer_auteur();

drop trigger if exists trg_auteur on public.forum_reponses;
create trigger trg_auteur before insert on public.forum_reponses
  for each row execute function public.forcer_auteur();

drop trigger if exists trg_auteur on public.astuces;
create trigger trg_auteur before insert on public.astuces
  for each row execute function public.forcer_auteur();

drop trigger if exists trg_auteur on public.annales;
create trigger trg_auteur before insert on public.annales
  for each row execute function public.forcer_auteur();

-- ---------------------------------------------------------------------
-- 3) Trigger AFTER UPDATE sur profils : propage le changement de nom
--    aux contenus dénormalisés (plus de noms périmés).
-- ---------------------------------------------------------------------
create or replace function public.propager_nom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare nom_aff text := public.nom_affichage(new.id);
begin
  if coalesce(new.prenom, '') is distinct from coalesce(old.prenom, '')
     or coalesce(new.nom, '') is distinct from coalesce(old.nom, '') then
    update public.forum_questions set auteur = nom_aff where user_id = new.id;
    update public.forum_reponses  set auteur = nom_aff where user_id = new.id;
    update public.astuces         set auteur = nom_aff where user_id = new.id;
    update public.annales         set auteur = nom_aff where user_id = new.id;
    update public.entraide        set prenom = new.prenom, nom = new.nom where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propager_nom on public.profils;
create trigger trg_propager_nom after update on public.profils
  for each row execute function public.propager_nom();

-- Rattrapage : réaligne les noms déjà stockés sur les profils actuels.
update public.forum_questions q set auteur = public.nom_affichage(q.user_id);
update public.forum_reponses  r set auteur = public.nom_affichage(r.user_id);
update public.astuces         a set auteur = public.nom_affichage(a.user_id);
update public.annales         a set auteur = public.nom_affichage(a.user_id);

-- ---------------------------------------------------------------------
-- 4) Quotas persistants (rate-limiting partagé entre instances Edge).
-- ---------------------------------------------------------------------
create table if not exists public.quota_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,
  created_at timestamptz not null default now()
);
create index if not exists quota_log_idx on public.quota_log (user_id, action, created_at desc);

alter table public.quota_log enable row level security;
-- Aucune policy : la table n'est manipulée que par la fonction (SECURITY DEFINER)
-- et le service_role. Les clients n'y accèdent jamais directement.

-- Consomme un jeton de quota : renvoie true si l'action est autorisée
-- (et l'enregistre), false si le plafond est atteint sur la fenêtre donnée.
create or replace function public.consommer_quota(
  p_user    uuid,
  p_action  text,
  p_max     int,
  p_fenetre interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  if p_user is null then return false; end if;
  -- Purge des entrées trop vieilles (au-delà de la plus longue fenêtre utile).
  delete from public.quota_log
    where user_id = p_user and created_at < now() - interval '25 hours';
  select count(*) into n from public.quota_log
    where user_id = p_user and action = p_action and created_at > now() - p_fenetre;
  if n >= p_max then return false; end if;
  insert into public.quota_log (user_id, action) values (p_user, p_action);
  return true;
end;
$$;

-- Seul le serveur (service_role) appelle cette fonction, avec un user vérifié.
revoke execute on function public.consommer_quota(uuid, text, int, interval) from public, anon, authenticated;
grant  execute on function public.consommer_quota(uuid, text, int, interval) to service_role;
