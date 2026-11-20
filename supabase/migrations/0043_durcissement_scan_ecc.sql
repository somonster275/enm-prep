-- 0043 — Durcissements issus du scan ECC. Ré-exécutable sans erreur.
--  1) matchs : plus d'update client (l'hôte pouvait changer chrono / mode en pleine partie).
--     Le lancement passe par /api/duel/lancer, la clôture par /api/duel/terminer (service role).
--  2) nom_affichage : plus appelable par les clients (révélait le début de l'e-mail de n'importe qui).
--     Les triggers qui l'utilisent sont SECURITY DEFINER : ils gardent le droit d'exécution.
--  3) incr_nouvelles : delta borné à -1 / +1, date limitée à hier / aujourd'hui / demain, retiré à anon.
--  4) activite_jours : doublons fusionnés, unicité (utilisateur_id, jour), incr_activite en ON CONFLICT.

-- 1) ---------------------------------------------------------------
drop policy if exists "matchs_update" on public.matchs;

-- 2) ---------------------------------------------------------------
revoke execute on function public.nom_affichage(uuid) from public, anon, authenticated;

-- 3) ---------------------------------------------------------------
create or replace function public.incr_nouvelles(p_jour date, p_delta int)
returns int language plpgsql security definer set search_path = public as $$
declare
  d int := greatest(-1, least(1, coalesce(p_delta, 0)));
  v int;
begin
  if auth.uid() is null or p_jour not between current_date - 1 and current_date + 1 then
    return 0;
  end if;
  insert into public.nouvelles_jours(user_id, jour, n)
    values (auth.uid(), p_jour, greatest(0, d))
  on conflict (user_id, jour)
    do update set n = greatest(0, nouvelles_jours.n + d)
  returning n into v;
  return v;
end $$;
revoke all on function public.incr_nouvelles(date, int) from public, anon;
grant execute on function public.incr_nouvelles(date, int) to authenticated;

-- 4) ---------------------------------------------------------------
-- Fusionne les doublons éventuels (somme plafonnée à 1 000) avant de poser l'unicité.
with doublons as (
  select utilisateur_id, jour, least(1000, sum(cartes))::int as total, min(ctid) as garde
  from public.activite_jours
  group by utilisateur_id, jour
  having count(*) > 1
), maj as (
  update public.activite_jours a set cartes = d.total
  from doublons d where a.ctid = d.garde
  returning a.utilisateur_id
)
delete from public.activite_jours a
using doublons d
where a.utilisateur_id = d.utilisateur_id and a.jour = d.jour and a.ctid <> d.garde;

create unique index if not exists activite_jours_user_jour_uniq
  on public.activite_jours (utilisateur_id, jour);

create or replace function public.incr_activite(p_jour date, p_delta int)
returns void language plpgsql security definer set search_path = public as $$
declare d int := greatest(-1, least(1, coalesce(p_delta, 0)));
begin
  if auth.uid() is null or d = 0 or p_jour not between current_date - 1 and current_date + 1 then
    return;
  end if;
  if d > 0 then
    insert into public.activite_jours(utilisateur_id, jour, cartes)
      values (auth.uid(), p_jour, 1)
    on conflict (utilisateur_id, jour)
      do update set cartes = least(1000, activite_jours.cartes + 1);
  else
    update public.activite_jours set cartes = greatest(0, cartes - 1)
      where utilisateur_id = auth.uid() and jour = p_jour;
  end if;
end $$;
revoke all on function public.incr_activite(date, int) from public, anon;
grant execute on function public.incr_activite(date, int) to authenticated;

notify pgrst, 'reload schema';
