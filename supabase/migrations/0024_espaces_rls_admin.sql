-- Policies admin sur la table espaces (insert / update / delete)
-- Les admins peuvent gérer les espaces depuis le client.

drop policy if exists "admin_insert_espaces" on public.espaces;
drop policy if exists "admin_update_espaces" on public.espaces;
drop policy if exists "admin_delete_espaces" on public.espaces;

create policy "admin_insert_espaces" on public.espaces
  for insert to authenticated
  with check (
    exists (select 1 from public.profils where id = auth.uid() and role = 'admin')
  );

create policy "admin_update_espaces" on public.espaces
  for update to authenticated
  using (
    exists (select 1 from public.profils where id = auth.uid() and role = 'admin')
  );

create policy "admin_delete_espaces" on public.espaces
  for delete to authenticated
  using (
    exists (select 1 from public.profils where id = auth.uid() and role = 'admin')
  );
