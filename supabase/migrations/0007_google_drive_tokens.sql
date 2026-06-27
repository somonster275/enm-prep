-- =====================================================================
--  Connexion Google Drive (OAuth) — stockage des jetons par utilisateur
--  À exécuter dans Supabase : SQL Editor > coller > Run
--
--  SÉCURITÉ : RLS activé SANS aucune policy → ni les utilisateurs anon ni
--  authenticated ne peuvent lire cette table. Seules les routes serveur
--  (clé service_role, qui contourne RLS) y accèdent. Les jetons ne sont
--  JAMAIS envoyés au client.
-- =====================================================================

create table if not exists public.google_drive_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token text,
  access_token  text,
  expiry        timestamptz,
  email         text,
  updated_at    timestamptz not null default now()
);

alter table public.google_drive_tokens enable row level security;
