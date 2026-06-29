-- Rattachement d'un cours à un espace (matière) et, optionnellement, à un module
-- (chapitre), pour le répertorier au bon endroit.
alter table public.cours add column if not exists espace_id uuid references public.espaces(id) on delete set null;
alter table public.cours add column if not exists module_id uuid references public.modules(id) on delete set null;
create index if not exists cours_espace_idx on public.cours (espace_id);
create index if not exists cours_module_idx on public.cours (module_id);

notify pgrst, 'reload schema';
