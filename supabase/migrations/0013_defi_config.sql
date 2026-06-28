-- =====================================================================
--  Configuration du « Défi de la semaine » (pilotée par l'admin)
--  Une seule ligne (id = 1). À exécuter dans Supabase : SQL Editor > Run
-- =====================================================================

create table if not exists public.defi_config (
  id          int primary key default 1,
  type        text not null default 'fiches',  -- 'fiches' (auto-mesuré) | 'libre' (annonce)
  titre       text,
  description text,
  objectif    int  default 150,                -- cible de cartes (type 'fiches')
  matiere     text,                            -- thème / matière (facultatif, indicatif)
  updated_at  timestamptz not null default now(),
  constraint defi_single check (id = 1)
);

insert into public.defi_config (id) values (1) on conflict (id) do nothing;

alter table public.defi_config enable row level security;
-- Lecture par tous les étudiants connectés ; écriture via le serveur (service_role).
create policy "defi_select" on public.defi_config for select to authenticated using (true);
