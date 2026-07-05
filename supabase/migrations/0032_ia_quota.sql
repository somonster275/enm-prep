-- =====================================================================
--  Quota IA : borne les coûts (Claude + Voyage) des « Questions de cours »
--  Compte le nombre de questions posées par utilisateur et par jour.
--  Les écritures se font via le service role (route serveur) → RLS non requise
--  pour l'insert/update, mais on autorise chacun à lire son propre compteur.
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.ia_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  jour       date not null,
  questions  int  not null default 0,
  primary key (user_id, jour)
);

alter table public.ia_usage enable row level security;
create policy "ia_usage_select" on public.ia_usage for select to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
