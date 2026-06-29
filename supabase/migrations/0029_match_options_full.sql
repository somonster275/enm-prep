-- Débrief de duel : texte intégral de chaque option (pour afficher toute la carte
-- au clic). Parallèle à match_solutions.solutions : [[opt0_full, opt1_full, …], …]
alter table public.match_solutions add column if not exists options_full jsonb;

notify pgrst, 'reload schema';
