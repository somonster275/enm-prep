-- 0039 — Compteur d'activité (série, objectif du jour, classement) non falsifiable.
--
-- FAILLE CORRIGÉE : les policies héritées de activite_jours (dont « activite_jours_update »)
-- laissaient un étudiant écrire directement sa ligne via l'API REST (clé anon publique),
-- et la RPC incr_activite acceptait n'importe quel delta et n'importe quelle date
-- → un étudiant pouvait se mettre 100 000 cartes et passer 1er du classement.
--
-- Après cette migration :
--   - lecture : chacun lit uniquement sa propre activité (le classement passe par le serveur) ;
--   - aucune écriture directe côté client ;
--   - incr_activite : delta ramené à -1 / +1, date limitée à hier / aujourd'hui / demain
--     (fuseaux horaires), compteur borné entre 0 et 1 000 cartes par jour.
-- Ré-exécutable sans erreur.

alter table public.activite_jours enable row level security;

-- Supprime TOUTES les policies existantes (noms hérités inconnus), puis recrée la lecture seule.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'activite_jours' loop
    execute format('drop policy %I on public.activite_jours', p.policyname);
  end loop;
end $$;

create policy "activite_jours_select_self" on public.activite_jours
  for select to authenticated using (utilisateur_id = auth.uid());

create or replace function public.incr_activite(p_jour date, p_delta int)
returns void language plpgsql security definer set search_path = public as $$
declare d int := greatest(-1, least(1, coalesce(p_delta, 0)));
begin
  if auth.uid() is null or d = 0 or p_jour not between current_date - 1 and current_date + 1 then
    return;
  end if;
  update public.activite_jours set cartes = greatest(0, least(1000, cartes + d))
    where utilisateur_id = auth.uid() and jour = p_jour;
  if not found and d > 0 then
    insert into public.activite_jours(utilisateur_id, jour, cartes)
      values (auth.uid(), p_jour, d);
  end if;
end $$;

revoke all on function public.incr_activite(date, int) from public, anon;
grant execute on function public.incr_activite(date, int) to authenticated;
