-- 0041 — Liens d'annales sûrs + suppression des comptes admin débloquée.
-- Ré-exécutable sans erreur.

-- FAILLE CORRIGÉE : seule la page vérifiait que le lien commence par https://.
-- En passant par l'API REST, un étudiant pouvait enregistrer « javascript:… » :
-- le clic d'un autre utilisateur (admin compris) exécutait ce code avec sa session.
-- NOT VALID : s'applique à toute nouvelle ligne sans bloquer si une ancienne ligne est fautive.
alter table public.annales drop constraint if exists annales_url_http;
alter table public.annales add constraint annales_url_http check (url ~* '^https?://') not valid;

-- Supprimer un admin qui a traité une demande d'accès échouait (clé étrangère sans règle).
alter table public.demandes_acces drop constraint if exists demandes_acces_traite_par_fkey;
alter table public.demandes_acces add constraint demandes_acces_traite_par_fkey
  foreign key (traite_par) references auth.users(id) on delete set null;
