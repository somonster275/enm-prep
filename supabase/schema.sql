-- =====================================================================
--  Schéma complet de la base (schéma public), exporté le 2026-11-20 depuis le SQL Editor.
--  STRUCTURE SEULEMENT : aucune donnée (fiches, progression…). Ce n'est PAS une sauvegarde.
--  Sert à reconstruire une base vide équivalente (nouveau projet Supabase) avant d'y
--  restaurer des données. Non inclus : buckets Storage et leurs règles (recréer les
--  buckets via /api/storage/init), schéma auth (géré par Supabase).
--  Ré-exporter avec la requête de supabase/README-schema.md après chaque migration.
-- =====================================================================

create extension if not exists pg_stat_statements with schema extensions;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists supabase_vault with schema vault;

create extension if not exists "uuid-ossp" with schema extensions;

create extension if not exists vector with schema public;

create table if not exists public.activite_jours (
  utilisateur_id uuid not null,
  jour date not null,
  cartes integer default 0 not null
);

create table if not exists public.annales (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  auteur text,
  titre text not null,
  type text,
  matiere text,
  url text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.astuces (
  id uuid default gen_random_uuid() not null,
  fiche_id uuid not null,
  user_id uuid not null,
  auteur text,
  texte text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.calendrier_flux (
  id uuid default gen_random_uuid() not null,
  nom text not null,
  url text not null,
  couleur text default '#6366F1'::text,
  created_at timestamp with time zone default now()
);

create table if not exists public.coach_messages (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  role text not null,
  contenu text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.contributions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  type text not null,
  statut text default 'nouveau'::text not null,
  titre text,
  matiere text,
  espace_id uuid,
  module_id uuid,
  payload jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.cours (
  id uuid default gen_random_uuid() not null,
  titre text not null,
  description text,
  matiere text,
  fichier_url text not null,
  fichier_nom text,
  type text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  espace_id uuid,
  module_id uuid,
  tags text[] default '{}'::text[] not null
);

create table if not exists public.cours_chunks (
  id uuid default gen_random_uuid() not null,
  document_id uuid,
  contenu text not null,
  "position" integer default 0,
  embedding vector(1024)
);

create table if not exists public.cours_documents (
  id uuid default gen_random_uuid() not null,
  nom text not null,
  espace_id uuid,
  nb_chunks integer default 0,
  created_by uuid,
  created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,
  portee text default 'officiel'::text not null
);

create table if not exists public.cours_remarques (
  id uuid default gen_random_uuid() not null,
  cours_id uuid not null,
  user_id uuid not null,
  message text not null,
  statut text default 'nouveau'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.defi_config (
  id integer default 1 not null,
  type text default 'fiches'::text not null,
  titre text,
  description text,
  objectif integer default 150,
  matiere text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.demandes_acces (
  id uuid default gen_random_uuid() not null,
  nom text,
  email text not null,
  message text,
  statut text default 'en_attente'::text not null,
  created_at timestamp with time zone default now() not null,
  traite_at timestamp with time zone,
  traite_par uuid
);

create table if not exists public.drive_liens (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  titre text not null,
  url text not null,
  fournisseur text,
  matiere text,
  ordre integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.entraide (
  user_id uuid not null,
  prenom text,
  nom text,
  contact text not null,
  matieres text not null,
  message text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.espaces (
  id uuid default gen_random_uuid() not null,
  nom text not null,
  slug text not null,
  description text,
  couleur text default '#534AB7'::text,
  ordre integer default 0,
  created_at timestamp with time zone default now(),
  icone text default '📚'::text not null
);

create table if not exists public.evenements (
  id uuid default gen_random_uuid() not null,
  titre text not null,
  description text,
  date_debut date not null,
  heure text,
  type text default 'autre'::text,
  couleur text default '#2DAE83'::text,
  created_by uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.favoris (
  user_id uuid not null,
  fiche_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.fiches (
  id uuid default gen_random_uuid() not null,
  module_id uuid,
  question text not null,
  reponse text not null,
  tags text[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,
  suspendu boolean default false not null
);

create table if not exists public.forum_questions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  auteur text,
  matiere text,
  titre text not null,
  corps text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.forum_reponses (
  id uuid default gen_random_uuid() not null,
  question_id uuid not null,
  user_id uuid not null,
  auteur text,
  corps text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.google_drive_tokens (
  user_id uuid not null,
  refresh_token text,
  access_token text,
  expiry timestamp with time zone,
  email text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.ia_usage (
  user_id uuid not null,
  jour date not null,
  questions integer default 0 not null
);

create table if not exists public.match_joueurs (
  match_id uuid not null,
  user_id uuid not null,
  pseudo text not null,
  score integer default 0 not null,
  repondu integer default 0 not null,
  justes integer default 0 not null,
  termine boolean default false not null,
  joined_at timestamp with time zone default now() not null
);

create table if not exists public.match_reponses (
  match_id uuid not null,
  user_id uuid not null,
  q_index integer not null,
  juste boolean default false not null,
  points integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  choix jsonb
);

create table if not exists public.match_solutions (
  match_id uuid not null,
  solutions jsonb not null,
  origines jsonb,
  options_full jsonb
);

create table if not exists public.matchs (
  id uuid default gen_random_uuid() not null,
  code text not null,
  hote_id uuid not null,
  titre text,
  statut text default 'attente'::text not null,
  deck jsonb default '[]'::jsonb not null,
  secondes_par_question integer default 20 not null,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  mode text default 'live'::text not null,
  expire_at timestamp with time zone
);

create table if not exists public.media_vues (
  user_id uuid not null,
  media_id uuid not null,
  vu_at timestamp with time zone default now() not null
);

create table if not exists public.medias (
  id uuid default gen_random_uuid() not null,
  espace_id uuid not null,
  titre text not null,
  type text default 'audio'::text,
  url text,
  created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,
  description text,
  tags text[] default '{}'::text[] not null
);

create table if not exists public.mindmaps (
  id uuid default gen_random_uuid() not null,
  espace_id uuid not null,
  titre text not null,
  url text,
  created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,
  tags text[] default '{}'::text[] not null
);

create table if not exists public.modules (
  id uuid default gen_random_uuid() not null,
  espace_id uuid,
  nom text not null,
  description text,
  ordre integer default 0,
  created_at timestamp with time zone default now(),
  parent_id uuid,
  deleted_at timestamp with time zone
);

create table if not exists public.notes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  contenu text not null,
  fait boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  type text not null,
  texte text not null,
  lien text,
  lu boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.nouvelles_jours (
  user_id uuid not null,
  jour date not null,
  n integer default 0 not null
);

create table if not exists public.pauses (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  debut date not null,
  fin date not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.profils (
  id uuid not null,
  email text not null,
  nom text,
  role text default 'lecteur'::text,
  created_at timestamp with time zone default now(),
  prenom text
);

create table if not exists public.progression (
  id uuid default gen_random_uuid() not null,
  utilisateur_id uuid,
  fiche_id uuid,
  niveau integer default 0,
  prochaine_revision timestamp with time zone default now(),
  derniere_revision timestamp with time zone
);

create table if not exists public.qcm (
  id uuid default gen_random_uuid() not null,
  espace_id uuid,
  titre text not null,
  url text,
  created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,
  type text default 'choix'::text not null,
  matiere text,
  tags text[] default '{}'::text[] not null
);

create table if not exists public.qcm_questions (
  id uuid default gen_random_uuid() not null,
  qcm_id uuid not null,
  enonce text not null,
  options jsonb default '[]'::jsonb not null,
  explication text,
  ordre integer default 0 not null,
  cas text,
  reponses_ok jsonb,
  reponse_affichee text
);

create table if not exists public.qcm_reponses (
  user_id uuid not null,
  question_id uuid not null,
  qcm_id uuid not null,
  juste boolean not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.qcm_resultats (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  qcm_id uuid not null,
  score integer not null,
  total integer not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.quota_log (
  id bigint generated always as identity not null,
  user_id uuid not null,
  action text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.remarques_fiches (
  id uuid default gen_random_uuid() not null,
  fiche_id uuid not null,
  user_id uuid not null,
  message text not null,
  statut text default 'nouveau'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.sources_actualites (
  id uuid default gen_random_uuid() not null,
  nom text not null,
  url text not null,
  couleur text default '#DC4A2B'::text,
  created_at timestamp with time zone default now()
);

alter table public.activite_jours add constraint activite_jours_pkey PRIMARY KEY (utilisateur_id, jour);

alter table public.annales add constraint annales_pkey PRIMARY KEY (id);

alter table public.annales add constraint annales_url_http CHECK ((url ~* '^https?://'::text)) NOT VALID;

alter table public.astuces add constraint astuces_pkey PRIMARY KEY (id);

alter table public.calendrier_flux add constraint calendrier_flux_pkey PRIMARY KEY (id);

alter table public.coach_messages add constraint coach_messages_pkey PRIMARY KEY (id);

alter table public.contributions add constraint contributions_pkey PRIMARY KEY (id);

alter table public.cours_chunks add constraint cours_chunks_pkey PRIMARY KEY (id);

alter table public.cours_documents add constraint cours_documents_pkey PRIMARY KEY (id);

alter table public.cours_documents add constraint cours_documents_portee_check CHECK ((portee = ANY (ARRAY['officiel'::text, 'personnel'::text])));

alter table public.cours_remarques add constraint cours_remarques_pkey PRIMARY KEY (id);

alter table public.cours add constraint cours_pkey PRIMARY KEY (id);

alter table public.defi_config add constraint defi_config_pkey PRIMARY KEY (id);

alter table public.defi_config add constraint defi_single CHECK ((id = 1));

alter table public.demandes_acces add constraint demandes_acces_pkey PRIMARY KEY (id);

alter table public.demandes_acces add constraint demandes_acces_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'approuve'::text, 'refuse'::text])));

alter table public.drive_liens add constraint drive_liens_pkey PRIMARY KEY (id);

alter table public.entraide add constraint entraide_pkey PRIMARY KEY (user_id);

alter table public.espaces add constraint espaces_pkey PRIMARY KEY (id);

alter table public.espaces add constraint espaces_slug_key UNIQUE (slug);

alter table public.evenements add constraint evenements_pkey PRIMARY KEY (id);

alter table public.favoris add constraint favoris_pkey PRIMARY KEY (user_id, fiche_id);

alter table public.fiches add constraint fiches_pkey PRIMARY KEY (id);

alter table public.forum_questions add constraint forum_questions_pkey PRIMARY KEY (id);

alter table public.forum_reponses add constraint forum_reponses_pkey PRIMARY KEY (id);

alter table public.google_drive_tokens add constraint google_drive_tokens_pkey PRIMARY KEY (user_id);

alter table public.ia_usage add constraint ia_usage_pkey PRIMARY KEY (user_id, jour);

alter table public.match_joueurs add constraint match_joueurs_pkey PRIMARY KEY (match_id, user_id);

alter table public.match_reponses add constraint match_reponses_pkey PRIMARY KEY (match_id, user_id, q_index);

alter table public.match_solutions add constraint match_solutions_pkey PRIMARY KEY (match_id);

alter table public.matchs add constraint matchs_code_key UNIQUE (code);

alter table public.matchs add constraint matchs_pkey PRIMARY KEY (id);

alter table public.media_vues add constraint media_vues_pkey PRIMARY KEY (user_id, media_id);

alter table public.medias add constraint medias_pkey PRIMARY KEY (id);

alter table public.mindmaps add constraint mindmaps_pkey PRIMARY KEY (id);

alter table public.modules add constraint modules_pkey PRIMARY KEY (id);

alter table public.notes add constraint notes_pkey PRIMARY KEY (id);

alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);

alter table public.nouvelles_jours add constraint nouvelles_jours_pkey PRIMARY KEY (user_id, jour);

alter table public.pauses add constraint pauses_fin_apres_debut CHECK ((fin >= debut)) NOT VALID;

alter table public.pauses add constraint pauses_pkey PRIMARY KEY (id);

alter table public.profils add constraint profils_pkey PRIMARY KEY (id);

alter table public.profils add constraint profils_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'editeur'::text, 'lecteur'::text])));

alter table public.progression add constraint progression_niveau_check CHECK ((niveau = ANY (ARRAY[0, 1, 2, 3])));

alter table public.progression add constraint progression_pkey PRIMARY KEY (id);

alter table public.progression add constraint progression_utilisateur_id_fiche_id_key UNIQUE (utilisateur_id, fiche_id);

alter table public.qcm_questions add constraint qcm_questions_pkey PRIMARY KEY (id);

alter table public.qcm_reponses add constraint qcm_reponses_pkey PRIMARY KEY (user_id, question_id);

alter table public.qcm_resultats add constraint qcm_resultats_pkey PRIMARY KEY (id);

alter table public.qcm add constraint qcm_pkey PRIMARY KEY (id);

alter table public.quota_log add constraint quota_log_pkey PRIMARY KEY (id);

alter table public.remarques_fiches add constraint remarques_fiches_pkey PRIMARY KEY (id);

alter table public.sources_actualites add constraint sources_actualites_pkey PRIMARY KEY (id);

alter table public.activite_jours add constraint activite_jours_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.annales add constraint annales_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.astuces add constraint astuces_fiche_id_fkey FOREIGN KEY (fiche_id) REFERENCES fiches(id) ON DELETE CASCADE;

alter table public.astuces add constraint astuces_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.coach_messages add constraint coach_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.contributions add constraint contributions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.cours_chunks add constraint cours_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES cours_documents(id) ON DELETE CASCADE;

alter table public.cours_documents add constraint cours_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.cours_documents add constraint cours_documents_espace_id_fkey FOREIGN KEY (espace_id) REFERENCES espaces(id);

alter table public.cours_remarques add constraint cours_remarques_cours_id_fkey FOREIGN KEY (cours_id) REFERENCES cours(id) ON DELETE CASCADE;

alter table public.cours_remarques add constraint cours_remarques_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.cours add constraint cours_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public.cours add constraint cours_espace_id_fkey FOREIGN KEY (espace_id) REFERENCES espaces(id) ON DELETE SET NULL;

alter table public.cours add constraint cours_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL;

alter table public.demandes_acces add constraint demandes_acces_traite_par_fkey FOREIGN KEY (traite_par) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public.drive_liens add constraint drive_liens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.entraide add constraint entraide_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.evenements add constraint evenements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public.favoris add constraint favoris_fiche_id_fkey FOREIGN KEY (fiche_id) REFERENCES fiches(id) ON DELETE CASCADE;

alter table public.favoris add constraint favoris_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.fiches add constraint fiches_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

alter table public.forum_questions add constraint forum_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.forum_reponses add constraint forum_reponses_question_id_fkey FOREIGN KEY (question_id) REFERENCES forum_questions(id) ON DELETE CASCADE;

alter table public.forum_reponses add constraint forum_reponses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.google_drive_tokens add constraint google_drive_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.ia_usage add constraint ia_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.match_joueurs add constraint match_joueurs_match_id_fkey FOREIGN KEY (match_id) REFERENCES matchs(id) ON DELETE CASCADE;

alter table public.match_joueurs add constraint match_joueurs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.match_reponses add constraint match_reponses_match_id_fkey FOREIGN KEY (match_id) REFERENCES matchs(id) ON DELETE CASCADE;

alter table public.match_reponses add constraint match_reponses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.match_solutions add constraint match_solutions_match_id_fkey FOREIGN KEY (match_id) REFERENCES matchs(id) ON DELETE CASCADE;

alter table public.matchs add constraint matchs_hote_id_fkey FOREIGN KEY (hote_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.media_vues add constraint media_vues_media_id_fkey FOREIGN KEY (media_id) REFERENCES medias(id) ON DELETE CASCADE;

alter table public.media_vues add constraint media_vues_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.medias add constraint medias_espace_id_fkey FOREIGN KEY (espace_id) REFERENCES espaces(id) ON DELETE CASCADE;

alter table public.mindmaps add constraint mindmaps_espace_id_fkey FOREIGN KEY (espace_id) REFERENCES espaces(id) ON DELETE CASCADE;

alter table public.modules add constraint modules_espace_id_fkey FOREIGN KEY (espace_id) REFERENCES espaces(id) ON DELETE CASCADE;

alter table public.modules add constraint modules_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES modules(id) ON DELETE CASCADE;

alter table public.notes add constraint notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.nouvelles_jours add constraint nouvelles_jours_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.pauses add constraint pauses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.profils add constraint profils_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.progression add constraint progression_fiche_id_fkey FOREIGN KEY (fiche_id) REFERENCES fiches(id) ON DELETE CASCADE;

alter table public.progression add constraint progression_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES profils(id) ON DELETE CASCADE;

alter table public.qcm_questions add constraint qcm_questions_qcm_id_fkey FOREIGN KEY (qcm_id) REFERENCES qcm(id) ON DELETE CASCADE;

alter table public.qcm_reponses add constraint qcm_reponses_qcm_id_fkey FOREIGN KEY (qcm_id) REFERENCES qcm(id) ON DELETE CASCADE;

alter table public.qcm_reponses add constraint qcm_reponses_question_id_fkey FOREIGN KEY (question_id) REFERENCES qcm_questions(id) ON DELETE CASCADE;

alter table public.qcm_reponses add constraint qcm_reponses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.qcm_resultats add constraint qcm_resultats_qcm_id_fkey FOREIGN KEY (qcm_id) REFERENCES qcm(id) ON DELETE CASCADE;

alter table public.qcm_resultats add constraint qcm_resultats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.qcm add constraint qcm_espace_id_fkey FOREIGN KEY (espace_id) REFERENCES espaces(id) ON DELETE CASCADE;

alter table public.quota_log add constraint quota_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.remarques_fiches add constraint remarques_fiches_fiche_id_fkey FOREIGN KEY (fiche_id) REFERENCES fiches(id) ON DELETE CASCADE;

alter table public.remarques_fiches add constraint remarques_fiches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index en double retirés ici (migration 0047) : activite_jours_user_jour_uniq (= clé primaire)
-- et cours_chunks_fts_idx (= cours_chunks_to_tsvector_idx).

CREATE INDEX annales_idx ON public.annales USING btree (created_at DESC);

CREATE INDEX annales_user_id_idx ON public.annales USING btree (user_id);

CREATE INDEX astuces_fiche_idx ON public.astuces USING btree (fiche_id, created_at);

CREATE INDEX astuces_user_id_idx ON public.astuces USING btree (user_id);

CREATE INDEX coach_msg_idx ON public.coach_messages USING btree (user_id, created_at);

CREATE INDEX contributions_statut_idx ON public.contributions USING btree (statut, created_at DESC);

CREATE INDEX contributions_user_idx ON public.contributions USING btree (user_id, created_at DESC);

CREATE INDEX cours_chunks_embedding_idx ON public.cours_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX cours_chunks_to_tsvector_idx ON public.cours_chunks USING gin (to_tsvector('french'::regconfig, contenu));

CREATE INDEX cours_documents_createur_idx ON public.cours_documents USING btree (created_by);

CREATE INDEX cours_documents_portee_idx ON public.cours_documents USING btree (portee);

CREATE INDEX cours_espace_idx ON public.cours USING btree (espace_id);

CREATE INDEX cours_module_idx ON public.cours USING btree (module_id);

CREATE INDEX cours_tags_idx ON public.cours USING gin (tags);

CREATE INDEX demandes_acces_statut_idx ON public.demandes_acces USING btree (statut, created_at);

CREATE INDEX drive_liens_user_idx ON public.drive_liens USING btree (user_id, ordre, created_at);

CREATE INDEX entraide_maj_idx ON public.entraide USING btree (updated_at DESC);

CREATE INDEX favoris_fiche_id_idx ON public.favoris USING btree (fiche_id);

CREATE INDEX fiches_actives_idx ON public.fiches USING btree (module_id) WHERE ((deleted_at IS NULL) AND (suspendu = false));

CREATE INDEX fiches_tags_idx ON public.fiches USING gin (tags);

CREATE INDEX forum_q_idx ON public.forum_questions USING btree (created_at DESC);

CREATE INDEX forum_questions_user_id_idx ON public.forum_questions USING btree (user_id);

CREATE INDEX forum_r_idx ON public.forum_reponses USING btree (question_id, created_at);

CREATE INDEX forum_reponses_user_id_idx ON public.forum_reponses USING btree (user_id);

CREATE INDEX matchs_statut_idx ON public.matchs USING btree (statut, created_at DESC);

CREATE INDEX media_vues_media_id_idx ON public.media_vues USING btree (media_id);

CREATE INDEX medias_tags_idx ON public.medias USING gin (tags);

CREATE INDEX mindmaps_tags_idx ON public.mindmaps USING gin (tags);

CREATE INDEX modules_parent_id_idx ON public.modules USING btree (parent_id);

CREATE INDEX notes_user_idx ON public.notes USING btree (user_id, fait, created_at DESC);

CREATE INDEX notifications_idx ON public.notifications USING btree (user_id, created_at DESC);

CREATE INDEX pauses_user_idx ON public.pauses USING btree (user_id, debut);

CREATE INDEX qcm_q_idx ON public.qcm_questions USING btree (qcm_id, ordre);

CREATE INDEX qcm_reponses_idx ON public.qcm_reponses USING btree (user_id, juste);

CREATE INDEX qcm_reponses_question_id_idx ON public.qcm_reponses USING btree (question_id);

CREATE INDEX qcm_res_idx ON public.qcm_resultats USING btree (user_id, created_at DESC);

CREATE INDEX qcm_resultats_qcm_id_idx ON public.qcm_resultats USING btree (qcm_id);

CREATE INDEX qcm_tags_idx ON public.qcm USING gin (tags);

CREATE INDEX quota_log_idx ON public.quota_log USING btree (user_id, action, created_at DESC);

CREATE INDEX remarques_fiche_idx ON public.remarques_fiches USING btree (fiche_id);

CREATE INDEX remarques_statut_idx ON public.remarques_fiches USING btree (statut, created_at DESC);

alter table public.activite_jours enable row level security;

alter table public.annales enable row level security;

alter table public.astuces enable row level security;

alter table public.calendrier_flux enable row level security;

alter table public.coach_messages enable row level security;

alter table public.contributions enable row level security;

alter table public.cours enable row level security;

alter table public.cours_chunks enable row level security;

alter table public.cours_documents enable row level security;

alter table public.cours_remarques enable row level security;

alter table public.defi_config enable row level security;

alter table public.demandes_acces enable row level security;

alter table public.drive_liens enable row level security;

alter table public.entraide enable row level security;

alter table public.espaces enable row level security;

alter table public.evenements enable row level security;

alter table public.favoris enable row level security;

alter table public.fiches enable row level security;

alter table public.forum_questions enable row level security;

alter table public.forum_reponses enable row level security;

alter table public.google_drive_tokens enable row level security;

alter table public.ia_usage enable row level security;

alter table public.match_joueurs enable row level security;

alter table public.match_reponses enable row level security;

alter table public.match_solutions enable row level security;

alter table public.matchs enable row level security;

alter table public.media_vues enable row level security;

alter table public.medias enable row level security;

alter table public.mindmaps enable row level security;

alter table public.modules enable row level security;

alter table public.notes enable row level security;

alter table public.notifications enable row level security;

alter table public.nouvelles_jours enable row level security;

alter table public.pauses enable row level security;

alter table public.profils enable row level security;

alter table public.progression enable row level security;

alter table public.qcm enable row level security;

alter table public.qcm_questions enable row level security;

alter table public.qcm_reponses enable row level security;

alter table public.qcm_resultats enable row level security;

alter table public.quota_log enable row level security;

alter table public.remarques_fiches enable row level security;

alter table public.sources_actualites enable row level security;

CREATE OR REPLACE FUNCTION public.consommer_quota(p_user uuid, p_action text, p_max integer, p_fenetre interval)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  if p_user is null then return false; end if;
  delete from public.quota_log
    where user_id = p_user and created_at < now() - interval '25 hours';
  select count(*) into n from public.quota_log
    where user_id = p_user and action = p_action and created_at > now() - p_fenetre;
  if n >= p_max then return false; end if;
  insert into public.quota_log (user_id, action) values (p_user, p_action);
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.forcer_auteur()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.user_id := auth.uid();
  new.auteur  := public.nom_affichage(auth.uid());
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.forcer_pseudo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.user_id := auth.uid();
  new.pseudo  := public.nom_affichage(auth.uid());
  new.score   := 0;
  new.repondu := 0;
  new.justes  := 0;
  new.termine := false;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.incr_activite(p_jour date, p_delta integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d int := greatest(-1, least(1, coalesce(p_delta, 0)));
begin
  if auth.uid() is null or d = 0 or p_jour not between current_date - 1 and current_date + 1 then
    return;
  end if;
  if d > 0 then
    insert into public.activite_jours(utilisateur_id, jour, cartes)
      values (auth.uid(), p_jour, 1)
    on conflict (utilisateur_id, jour)
      do update set cartes = least(1000, activite_jours.cartes + 1);
  else
    update public.activite_jours set cartes = greatest(0, cartes - 1)
      where utilisateur_id = auth.uid() and jour = p_jour;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.incr_ia_usage(p_user uuid, p_jour date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v int;
begin
  insert into public.ia_usage(user_id, jour, questions)
    values (p_user, p_jour, 1)
  on conflict (user_id, jour)
    do update set questions = ia_usage.questions + 1
  returning questions into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.incr_nouvelles(p_jour date, p_delta integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d int := greatest(-1, least(1, coalesce(p_delta, 0)));
  v int;
begin
  if auth.uid() is null or p_jour not between current_date - 1 and current_date + 1 then
    return 0;
  end if;
  insert into public.nouvelles_jours(user_id, jour, n)
    values (auth.uid(), p_jour, greatest(0, d))
  on conflict (user_id, jour)
    do update set n = greatest(0, nouvelles_jours.n + d)
  returning n into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.match_cours_chunks(query_embedding vector, match_count integer DEFAULT 8, filtre_espace uuid DEFAULT NULL::uuid, filtre_documents uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(contenu text, document_id uuid, document_nom text, similarite double precision)
 LANGUAGE plpgsql
AS $function$
begin
  begin
    perform set_config('hnsw.ef_search', '200', true);
  exception when others then null;
  end;
  return query
  select
    c.contenu::text,
    d.id::uuid,
    d.nom::text,
    (1 - (c.embedding <=> query_embedding))::float
  from public.cours_chunks c
  join public.cours_documents d on d.id = c.document_id
  where d.portee = 'officiel'
    and d.deleted_at is null
    and c.embedding is not null
    and (filtre_espace    is null or d.espace_id  = filtre_espace)
    and (filtre_documents is null or c.document_id = any(filtre_documents))
  order by c.embedding <=> query_embedding
  limit match_count;
end $function$
;

CREATE OR REPLACE FUNCTION public.nom_affichage(p_user uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    nullif(trim(coalesce(prenom, '') || ' ' || coalesce(nom, '')), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Étudiant'
  )
  from public.profils
  where id = p_user
$function$
;

CREATE OR REPLACE FUNCTION public.notif_forum_reponse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare titre_q text; auteur_rep text;
begin
  select titre into titre_q from public.forum_questions where id = new.question_id;
  auteur_rep := public.nom_affichage(new.user_id);
  insert into public.notifications (user_id, type, texte, lien)
  select destinataire, 'forum_reponse',
         auteur_rep || ' a répondu à « ' || coalesce(titre_q, 'ta question') || ' »', '/forum'
  from (
    select user_id as destinataire from public.forum_questions where id = new.question_id
    union
    select user_id from public.forum_reponses where question_id = new.question_id
  ) d
  where destinataire is not null and destinataire <> new.user_id
  group by destinataire;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.propager_nom()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare nom_aff text := public.nom_affichage(new.id);
begin
  if coalesce(new.prenom, '') is distinct from coalesce(old.prenom, '')
     or coalesce(new.nom, '') is distinct from coalesce(old.nom, '') then
    update public.forum_questions set auteur = nom_aff where user_id = new.id;
    update public.forum_reponses  set auteur = nom_aff where user_id = new.id;
    update public.astuces         set auteur = nom_aff where user_id = new.id;
    update public.annales         set auteur = nom_aff where user_id = new.id;
    update public.entraide        set prenom = new.prenom, nom = new.nom where user_id = new.id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recherche_mots_cours(p_query text, p_portee text, p_user uuid DEFAULT NULL::uuid, filtre_espace uuid DEFAULT NULL::uuid, filtre_documents uuid[] DEFAULT NULL::uuid[], match_count integer DEFAULT 8)
 RETURNS TABLE(contenu text, document_nom text, rang real)
 LANGUAGE sql
 STABLE
AS $function$
  select c.contenu::text, d.nom::text, ts_rank_cd(to_tsvector('french', c.contenu), q)::real
  from public.cours_chunks c
  join public.cours_documents d on d.id = c.document_id
  cross join to_tsquery('french', p_query) q
  where to_tsvector('french', c.contenu) @@ q
    and d.portee = p_portee
    and d.deleted_at is null
    and (p_portee <> 'personnel' or d.created_by = p_user)
    and (filtre_espace    is null or d.espace_id = filtre_espace)
    and (filtre_documents is null or c.document_id = any(filtre_documents))
  order by 3 desc
  limit match_count;
$function$
;

create policy activite_jours_select_self on public.activite_jours as permissive for select to authenticated using ((utilisateur_id = auth.uid()));

create policy annales_delete on public.annales as permissive for delete to authenticated using (((user_id = auth.uid()) OR (( SELECT profils.role
   FROM profils
  WHERE (profils.id = auth.uid())) = 'admin'::text)));

create policy annales_insert on public.annales as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy annales_select on public.annales as permissive for select to authenticated using (true);

create policy astuces_delete on public.astuces as permissive for delete to authenticated using (((user_id = auth.uid()) OR (( SELECT profils.role
   FROM profils
  WHERE (profils.id = auth.uid())) = 'admin'::text)));

create policy astuces_insert on public.astuces as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy astuces_select on public.astuces as permissive for select to authenticated using (true);

create policy cf_select on public.calendrier_flux as permissive for select to authenticated using (true);

create policy cf_write on public.calendrier_flux as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::text)))));

create policy coach_delete on public.coach_messages as permissive for delete to authenticated using ((user_id = auth.uid()));

create policy coach_insert on public.coach_messages as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy coach_select on public.coach_messages as permissive for select to authenticated using ((user_id = auth.uid()));

create policy contrib_select_self on public.contributions as permissive for select to authenticated using ((user_id = auth.uid()));

create policy cc_select on public.cours_chunks as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM cours_documents d
  WHERE ((d.id = cours_chunks.document_id) AND ((d.portee = 'officiel'::text) OR (d.created_by = auth.uid()))))));

create policy cc_write on public.cours_chunks as permissive for all to authenticated using (((EXISTS ( SELECT 1
   FROM cours_documents d
  WHERE ((d.id = cours_chunks.document_id) AND (d.portee = 'officiel'::text)))) AND (EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))))) with check (((EXISTS ( SELECT 1
   FROM cours_documents d
  WHERE ((d.id = cours_chunks.document_id) AND (d.portee = 'officiel'::text)))) AND (EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text])))))));

create policy cd_select on public.cours_documents as permissive for select to authenticated using (((portee = 'officiel'::text) OR (created_by = auth.uid())));

create policy cd_write on public.cours_documents as permissive for all to authenticated using (((portee = 'officiel'::text) AND (EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))))) with check (((portee = 'officiel'::text) AND (EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text])))))));

create policy cours_remarques_insert on public.cours_remarques as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy cours_remarques_select_self on public.cours_remarques as permissive for select to authenticated using ((user_id = auth.uid()));

create policy cours_delete on public.cours as permissive for delete to authenticated using ((( SELECT profils.role
   FROM profils
  WHERE (profils.id = auth.uid())) = 'admin'::text));

create policy cours_insert on public.cours as permissive for insert to authenticated with check ((( SELECT profils.role
   FROM profils
  WHERE (profils.id = auth.uid())) = 'admin'::text));

create policy cours_select on public.cours as permissive for select to authenticated using (true);

create policy defi_select on public.defi_config as permissive for select to authenticated using (true);

create policy drive_delete on public.drive_liens as permissive for delete to authenticated using ((user_id = auth.uid()));

create policy drive_insert on public.drive_liens as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy drive_select on public.drive_liens as permissive for select to authenticated using ((user_id = auth.uid()));

create policy drive_update on public.drive_liens as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy entraide_delete_self on public.entraide as permissive for delete to authenticated using ((user_id = auth.uid()));

create policy entraide_insert_self on public.entraide as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy entraide_select_all on public.entraide as permissive for select to authenticated using (true);

create policy entraide_update_self on public.entraide as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy admin_delete_espaces on public.espaces as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::text)))));

create policy admin_insert_espaces on public.espaces as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::text)))));

create policy admin_update_espaces on public.espaces as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::text)))));

create policy espaces_select_connectes on public.espaces as permissive for select to authenticated using (true);

create policy ev_select on public.evenements as permissive for select to authenticated using (true);

create policy ev_write on public.evenements as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy favoris_delete on public.favoris as permissive for delete to authenticated using ((user_id = auth.uid()));

create policy favoris_insert on public.favoris as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy favoris_select on public.favoris as permissive for select to authenticated using ((user_id = auth.uid()));

create policy fiches_delete on public.fiches as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy fiches_insert on public.fiches as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy fiches_select on public.fiches as permissive for select to authenticated using (true);

create policy fiches_update on public.fiches as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy forum_q_delete on public.forum_questions as permissive for delete to authenticated using (((user_id = auth.uid()) OR (( SELECT profils.role
   FROM profils
  WHERE (profils.id = auth.uid())) = 'admin'::text)));

create policy forum_q_insert on public.forum_questions as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy forum_q_select on public.forum_questions as permissive for select to authenticated using (true);

create policy forum_r_delete on public.forum_reponses as permissive for delete to authenticated using (((user_id = auth.uid()) OR (( SELECT profils.role
   FROM profils
  WHERE (profils.id = auth.uid())) = 'admin'::text)));

create policy forum_r_insert on public.forum_reponses as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy forum_r_select on public.forum_reponses as permissive for select to authenticated using (true);

create policy ia_usage_select on public.ia_usage as permissive for select to authenticated using ((user_id = auth.uid()));

create policy mj_delete on public.match_joueurs as permissive for delete to authenticated using ((user_id = auth.uid()));

create policy mj_insert on public.match_joueurs as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy mj_select on public.match_joueurs as permissive for select to authenticated using (true);

create policy mr_select on public.match_reponses as permissive for select to authenticated using ((user_id = auth.uid()));

create policy matchs_delete on public.matchs as permissive for delete to authenticated using ((hote_id = auth.uid()));

create policy matchs_insert on public.matchs as permissive for insert to authenticated with check ((hote_id = auth.uid()));

create policy matchs_select on public.matchs as permissive for select to authenticated using (true);

create policy mv_delete on public.media_vues as permissive for delete to authenticated using ((user_id = auth.uid()));

create policy mv_insert on public.media_vues as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy mv_select on public.media_vues as permissive for select to authenticated using ((user_id = auth.uid()));

create policy md_select on public.medias as permissive for select to authenticated using (true);

create policy md_write on public.medias as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy mm_select on public.mindmaps as permissive for select to authenticated using (true);

create policy mm_write on public.mindmaps as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy modules_delete on public.modules as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy modules_insert on public.modules as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy modules_select on public.modules as permissive for select to authenticated using (true);

create policy modules_update on public.modules as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy notes_delete on public.notes as permissive for delete to authenticated using ((user_id = auth.uid()));

create policy notes_insert on public.notes as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy notes_select on public.notes as permissive for select to authenticated using ((user_id = auth.uid()));

create policy notes_update on public.notes as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy notif_delete on public.notifications as permissive for delete to authenticated using ((user_id = auth.uid()));

create policy notif_select on public.notifications as permissive for select to authenticated using ((user_id = auth.uid()));

create policy notif_update on public.notifications as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy nj_select on public.nouvelles_jours as permissive for select to authenticated using ((user_id = auth.uid()));

create policy pauses_delete on public.pauses as permissive for delete to authenticated using ((user_id = auth.uid()));

create policy pauses_insert on public.pauses as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy pauses_select on public.pauses as permissive for select to authenticated using ((user_id = auth.uid()));

create policy pauses_update on public.pauses as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy profils_insert_self on public.profils as permissive for insert to authenticated with check (((id = auth.uid()) AND (role = 'lecteur'::text)));

create policy profils_select_self on public.profils as permissive for select to authenticated using ((id = auth.uid()));

create policy progression_insert on public.progression as permissive for insert to authenticated with check ((utilisateur_id = auth.uid()));

create policy progression_own on public.progression as permissive for all to public using ((auth.uid() = utilisateur_id));

create policy progression_select on public.progression as permissive for select to authenticated using ((utilisateur_id = auth.uid()));

create policy progression_update on public.progression as permissive for update to authenticated using ((utilisateur_id = auth.uid()));

create policy qcmq_select on public.qcm_questions as permissive for select to authenticated using (true);

create policy qr_insert on public.qcm_reponses as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy qr_select on public.qcm_reponses as permissive for select to authenticated using ((user_id = auth.uid()));

create policy qr_update on public.qcm_reponses as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

create policy qcmr_insert on public.qcm_resultats as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy qcmr_select on public.qcm_resultats as permissive for select to authenticated using ((user_id = auth.uid()));

create policy qcm_delete on public.qcm as permissive for delete to authenticated using ((( SELECT profils.role
   FROM profils
  WHERE (profils.id = auth.uid())) = 'admin'::text));

create policy qcm_select on public.qcm as permissive for select to authenticated using (true);

create policy qcm_write on public.qcm as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::text, 'editeur'::text]))))));

create policy remarques_insert on public.remarques_fiches as permissive for insert to authenticated with check ((user_id = auth.uid()));

create policy remarques_select_self on public.remarques_fiches as permissive for select to authenticated using ((user_id = auth.uid()));

create policy src_select on public.sources_actualites as permissive for select to authenticated using (true);

create policy src_write on public.sources_actualites as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::text)))));

CREATE TRIGGER trg_auteur BEFORE INSERT ON public.annales FOR EACH ROW EXECUTE FUNCTION forcer_auteur();

CREATE TRIGGER trg_auteur BEFORE INSERT ON public.astuces FOR EACH ROW EXECUTE FUNCTION forcer_auteur();

CREATE TRIGGER trg_auteur BEFORE INSERT ON public.forum_questions FOR EACH ROW EXECUTE FUNCTION forcer_auteur();

CREATE TRIGGER trg_auteur BEFORE INSERT ON public.forum_reponses FOR EACH ROW EXECUTE FUNCTION forcer_auteur();

CREATE TRIGGER trg_notif_forum AFTER INSERT ON public.forum_reponses FOR EACH ROW EXECUTE FUNCTION notif_forum_reponse();

CREATE TRIGGER trg_pseudo BEFORE INSERT ON public.match_joueurs FOR EACH ROW EXECUTE FUNCTION forcer_pseudo();

CREATE TRIGGER trg_propager_nom AFTER UPDATE ON public.profils FOR EACH ROW EXECUTE FUNCTION propager_nom();

revoke all on function consommer_quota(uuid,text,integer,interval) from public, anon, authenticated;

grant execute on function consommer_quota(uuid,text,integer,interval) to service_role;

revoke all on function forcer_auteur() from public, anon, authenticated;

grant execute on function forcer_auteur() to anon;

grant execute on function forcer_auteur() to authenticated;

grant execute on function forcer_auteur() to service_role;

revoke all on function forcer_pseudo() from public, anon, authenticated;

grant execute on function forcer_pseudo() to anon;

grant execute on function forcer_pseudo() to authenticated;

grant execute on function forcer_pseudo() to service_role;

revoke all on function incr_activite(date,integer) from public, anon, authenticated;

grant execute on function incr_activite(date,integer) to authenticated;

grant execute on function incr_activite(date,integer) to service_role;

revoke all on function incr_ia_usage(uuid,date) from public, anon, authenticated;

grant execute on function incr_ia_usage(uuid,date) to service_role;

revoke all on function incr_nouvelles(date,integer) from public, anon, authenticated;

grant execute on function incr_nouvelles(date,integer) to authenticated;

grant execute on function incr_nouvelles(date,integer) to service_role;

revoke all on function match_cours_chunks(vector,integer,uuid,uuid[]) from public, anon, authenticated;

grant execute on function match_cours_chunks(vector,integer,uuid,uuid[]) to anon;

grant execute on function match_cours_chunks(vector,integer,uuid,uuid[]) to authenticated;

grant execute on function match_cours_chunks(vector,integer,uuid,uuid[]) to service_role;

revoke all on function nom_affichage(uuid) from public, anon, authenticated;

grant execute on function nom_affichage(uuid) to service_role;

revoke all on function notif_forum_reponse() from public, anon, authenticated;

grant execute on function notif_forum_reponse() to anon;

grant execute on function notif_forum_reponse() to authenticated;

grant execute on function notif_forum_reponse() to service_role;

revoke all on function propager_nom() from public, anon, authenticated;

grant execute on function propager_nom() to anon;

grant execute on function propager_nom() to authenticated;

grant execute on function propager_nom() to service_role;

revoke all on function recherche_mots_cours(text,text,uuid,uuid,uuid[],integer) from public, anon, authenticated;

grant execute on function recherche_mots_cours(text,text,uuid,uuid,uuid[],integer) to service_role;
