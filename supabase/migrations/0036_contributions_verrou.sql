-- =====================================================================
--  Contributions : l'insertion passe UNIQUEMENT par la route serveur
--  /api/contributions (validation du contenu + limite anti-spam, écriture en
--  service_role). On retire le droit d'insertion direct côté client, qui
--  permettait de contourner ces contrôles (payload arbitraire, file noyée).
--  La lecture de ses propres propositions (contrib_select_self) est conservée.
--  À exécuter dans Supabase APRÈS 0034 : SQL Editor > coller > Run
-- =====================================================================

drop policy if exists "contrib_insert" on public.contributions;

notify pgrst, 'reload schema';
