-- =====================================================================
--  Système de tags (#) transversal : relie les ressources entre elles et
--  affine la recherche. Chaque ressource porte un tableau de tags normalisés.
-- =====================================================================

alter table public.fiches   add column if not exists tags text[] not null default '{}';
alter table public.medias   add column if not exists tags text[] not null default '{}';
alter table public.mindmaps add column if not exists tags text[] not null default '{}';
alter table public.qcm      add column if not exists tags text[] not null default '{}';
alter table public.cours    add column if not exists tags text[] not null default '{}';

-- Index GIN : recherche par chevauchement de tags (opérateur &&) performante.
create index if not exists fiches_tags_idx   on public.fiches   using gin (tags);
create index if not exists medias_tags_idx   on public.medias   using gin (tags);
create index if not exists mindmaps_tags_idx on public.mindmaps using gin (tags);
create index if not exists qcm_tags_idx      on public.qcm      using gin (tags);
create index if not exists cours_tags_idx    on public.cours    using gin (tags);

notify pgrst, 'reload schema';
