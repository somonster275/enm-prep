-- =====================================================================
--  Duel ASYNCHRONE : un joueur crée un défi, l'adversaire rejoue le même
--  paquet figé quand il veut (sous 48 h). Pas d'horloge partagée : chacun
--  joue à son rythme, correction côté serveur, comparaison des scores.
--  À exécuter dans Supabase APRÈS 0018/0019 : SQL Editor > coller > Run
-- =====================================================================

-- 'live' = temps réel (existant) · 'async' = chacun joue quand il veut
alter table public.matchs add column if not exists mode text not null default 'live';
-- Date limite pour rejouer un duel asynchrone (48 h après création).
alter table public.matchs add column if not exists expire_at timestamptz;

notify pgrst, 'reload schema';
