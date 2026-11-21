-- La révision, les duels, le tableau de bord et le tuteur lisent/écrivent `progression.palier`
-- (nombre de révisions réussies, façon Anki), mais la colonne n'a jamais été créée :
-- toute note de révision était refusée par Supabase (PGRST204).
alter table public.progression add column if not exists palier int not null default 0;

-- Recharge le cache de schéma de l'API pour que la colonne soit visible tout de suite.
notify pgrst, 'reload schema';
