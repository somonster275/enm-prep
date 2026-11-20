-- 0042 — Un joueur ne peut plus s'inscrire à un duel avec un score inventé.
--
-- FAILLE CORRIGÉE : la policy « mj_insert » ne vérifiait que user_id. Via l'API REST, un étudiant
-- pouvait rejoindre un duel avec { score: 100000, justes: 50 } : sans jamais répondre, son score
-- n'était jamais recalculé par le serveur et il gagnait le duel.
-- Le trigger d'inscription (déjà chargé de forcer user_id et pseudo) remet aussi les compteurs à zéro ;
-- seul le serveur (service_role, /api/duel/repondre) les fait ensuite évoluer.
-- Ré-exécutable sans erreur.

create or replace function public.forcer_pseudo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.pseudo  := public.nom_affichage(auth.uid());
  new.score   := 0;
  new.repondu := 0;
  new.justes  := 0;
  new.termine := false;
  return new;
end;
$$;
