-- =====================================================================
--  « Mon Drive » : liens vers les espaces de stockage de l'étudiant
--  (Google Drive, iCloud, Dropbox, OneDrive, Notion…) pour centraliser
--  l'accès à ses cours depuis l'app.
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.drive_liens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  titre       text not null,
  url         text not null,
  fournisseur text,                       -- google | icloud | dropbox | onedrive | notion | autre
  matiere     text,                       -- libellé libre optionnel (ex. « Droit civil »)
  ordre       int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists drive_liens_user_idx on public.drive_liens (user_id, ordre, created_at);

-- Chaque utilisateur ne voit et ne gère que ses propres liens.
alter table public.drive_liens enable row level security;
create policy "drive_select" on public.drive_liens for select to authenticated using (user_id = auth.uid());
create policy "drive_insert" on public.drive_liens for insert to authenticated with check (user_id = auth.uid());
create policy "drive_update" on public.drive_liens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "drive_delete" on public.drive_liens for delete to authenticated using (user_id = auth.uid());
