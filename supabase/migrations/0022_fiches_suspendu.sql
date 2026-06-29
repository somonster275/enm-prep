-- =====================================================================
--  Suspension de fiches (admin) : retire une carte de la circulation
--  sans la supprimer. Réversible. À exécuter dans Supabase : SQL Editor.
-- =====================================================================

alter table public.fiches add column if not exists suspendu boolean not null default false;

-- Accélère les filtres « fiches actives » (non supprimées, non suspendues).
create index if not exists fiches_actives_idx on public.fiches (module_id) where deleted_at is null and suspendu = false;
