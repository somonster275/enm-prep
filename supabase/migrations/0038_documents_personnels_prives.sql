-- 0038 — Documents personnels réellement privés.
--
-- FUITE CORRIGÉE : cd_select / cc_select (using true) laissaient tout utilisateur connecté lire
-- les noms (cours_documents) ET le texte intégral (cours_chunks) des documents personnels des
-- autres étudiants, via l'API REST Supabase. cd_write / cc_write donnaient en plus aux éditeurs
-- l'accès complet aux documents personnels.
--
-- Après cette migration :
--   - un document « officiel » (base ENM) reste lisible par tous les connectés ;
--   - un document « personnel » n'est lisible que par son auteur ;
--   - les admins/éditeurs n'écrivent plus que dans la base officielle ;
--   - la suppression d'un document personnel passe par /api/cours/supprimer (service_role).
-- Ré-exécutable sans erreur.

alter table public.cours_documents enable row level security;
alter table public.cours_chunks enable row level security;

-- ---- cours_documents ----
drop policy if exists "cd_select" on public.cours_documents;
create policy "cd_select" on public.cours_documents for select to authenticated
  using (portee = 'officiel' or created_by = auth.uid());

drop policy if exists "cd_write" on public.cours_documents;
create policy "cd_write" on public.cours_documents for all to authenticated
  using (
    portee = 'officiel'
    and exists (select 1 from public.profils where id = auth.uid() and role in ('admin', 'editeur'))
  )
  with check (
    portee = 'officiel'
    and exists (select 1 from public.profils where id = auth.uid() and role in ('admin', 'editeur'))
  );

-- ---- cours_chunks (le texte des documents) ----
drop policy if exists "cc_select" on public.cours_chunks;
create policy "cc_select" on public.cours_chunks for select to authenticated
  using (exists (
    select 1 from public.cours_documents d
    where d.id = cours_chunks.document_id
      and (d.portee = 'officiel' or d.created_by = auth.uid())
  ));

drop policy if exists "cc_write" on public.cours_chunks;
create policy "cc_write" on public.cours_chunks for all to authenticated
  using (
    exists (select 1 from public.cours_documents d where d.id = cours_chunks.document_id and d.portee = 'officiel')
    and exists (select 1 from public.profils where id = auth.uid() and role in ('admin', 'editeur'))
  )
  with check (
    exists (select 1 from public.cours_documents d where d.id = cours_chunks.document_id and d.portee = 'officiel')
    and exists (select 1 from public.profils where id = auth.uid() and role in ('admin', 'editeur'))
  );
