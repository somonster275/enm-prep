-- Débrief de fin de duel : revoir les cartes interrogées + ranger les erreurs
-- dans les cartes à réviser (carnet / répétition espacée et « mes erreurs » QCM).

-- Origine de chaque question (parallèle à match_solutions.solutions) : permet de
-- relier une question à sa fiche ou à sa question de QCM d'origine, pour router
-- les erreurs vers la révision. [{ "cat": "fiche", "ficheId": "…" }, { "cat": "qcm", "qcmId": "…", "qId": "…" }, …]
alter table public.match_solutions add column if not exists origines jsonb;

-- Choix réellement sélectionnés par le joueur (pour le débrief « ta réponse »).
alter table public.match_reponses add column if not exists choix jsonb;

notify pgrst, 'reload schema';
