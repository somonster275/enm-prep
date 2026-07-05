-- =====================================================================
--  Compteurs quotidiens fiables :
--   - nouvelles cartes découvertes/jour → EN BASE (cross-device, non
--     contournable en navigation privée ; remplace le compteur localStorage)
--   - incréments ATOMIQUES via RPC (nouvelles / ia_usage / activité) :
--     un seul INSERT ... ON CONFLICT, plus de course read-then-write.
--  À exécuter dans Supabase APRÈS 0032 : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.nouvelles_jours (
  user_id uuid not null references auth.users(id) on delete cascade,
  jour    date not null,
  n       int  not null default 0,
  primary key (user_id, jour)
);
alter table public.nouvelles_jours enable row level security;
drop policy if exists "nj_select" on public.nouvelles_jours;
create policy "nj_select" on public.nouvelles_jours for select to authenticated using (user_id = auth.uid());

-- Incrément atomique des nouvelles cartes du jour (borné à >= 0). Appelé côté CLIENT
-- (revision) → identité via auth.uid(), donc chacun n'agit que sur sa propre ligne.
create or replace function public.incr_nouvelles(p_jour date, p_delta int)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into public.nouvelles_jours(user_id, jour, n)
    values (auth.uid(), p_jour, greatest(0, p_delta))
  on conflict (user_id, jour)
    do update set n = greatest(0, nouvelles_jours.n + p_delta)
  returning n into v;
  return v;
end $$;

-- Incrément atomique de l'activité du jour (activite_jours, table héritée sans
-- contrainte d'unicité garantie) : update-then-insert. Appelé côté CLIENT.
create or replace function public.incr_activite(p_jour date, p_delta int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.activite_jours set cartes = cartes + p_delta
    where utilisateur_id = auth.uid() and jour = p_jour;
  if not found then
    insert into public.activite_jours(utilisateur_id, jour, cartes)
      values (auth.uid(), p_jour, p_delta);
  end if;
end $$;

-- Incrément atomique du quota IA (ia_usage, migration 0032). Appelé côté SERVEUR
-- (service_role) → l'identité est passée en paramètre. Exécution retirée aux clients.
create or replace function public.incr_ia_usage(p_user uuid, p_jour date)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into public.ia_usage(user_id, jour, questions)
    values (p_user, p_jour, 1)
  on conflict (user_id, jour)
    do update set questions = ia_usage.questions + 1
  returning questions into v;
  return v;
end $$;
revoke all on function public.incr_ia_usage(uuid, date) from public, anon, authenticated;
grant execute on function public.incr_ia_usage(uuid, date) to service_role;

notify pgrst, 'reload schema';
