-- Icône (emoji) par espace de révision
alter table public.espaces add column if not exists icone text not null default '📚';
