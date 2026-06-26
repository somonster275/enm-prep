-- =====================================================================
--  Demandes d'accès lecteur (self-service depuis la page de connexion)
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.demandes_acces (
  id         uuid primary key default gen_random_uuid(),
  nom        text,
  email      text not null,
  message    text,
  statut     text not null default 'en_attente'
             check (statut in ('en_attente', 'approuve', 'refuse')),
  created_at timestamptz not null default now(),
  traite_at  timestamptz,
  traite_par uuid references auth.users(id)
);

create index if not exists demandes_acces_statut_idx
  on public.demandes_acces (statut, created_at);

-- RLS activée SANS policy : tout l'accès passe par les routes serveur
-- (service role, qui contourne RLS). Le public ne peut rien lire/écrire directement.
alter table public.demandes_acces enable row level security;
