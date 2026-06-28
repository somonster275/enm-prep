-- =====================================================================
--  Lot : vidéos « vue », QCM révision des erreurs, notifications.
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Médias marqués « vu » (progression perso).
-- ---------------------------------------------------------------------
create table if not exists public.media_vues (
  user_id  uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.medias(id) on delete cascade,
  vu_at    timestamptz not null default now(),
  primary key (user_id, media_id)
);
alter table public.media_vues enable row level security;
create policy "mv_select" on public.media_vues for select to authenticated using (user_id = auth.uid());
create policy "mv_insert" on public.media_vues for insert to authenticated with check (user_id = auth.uid());
create policy "mv_delete" on public.media_vues for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) Réponses QCM par question (stats + « réviser mes erreurs »).
-- ---------------------------------------------------------------------
create table if not exists public.qcm_reponses (
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.qcm_questions(id) on delete cascade,
  qcm_id      uuid not null references public.qcm(id) on delete cascade,
  juste       boolean not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index if not exists qcm_reponses_idx on public.qcm_reponses (user_id, juste);
alter table public.qcm_reponses enable row level security;
create policy "qr_select" on public.qcm_reponses for select to authenticated using (user_id = auth.uid());
create policy "qr_insert" on public.qcm_reponses for insert to authenticated with check (user_id = auth.uid());
create policy "qr_update" on public.qcm_reponses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3) Notifications in-app.
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,                 -- 'forum_reponse' | …
  texte      text not null,
  lien       text,
  lu         boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
-- Le destinataire lit et marque comme lues ses notifications ; l'écriture se
-- fait via trigger (security definer) ou service_role.
create policy "notif_select" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif_update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif_delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Notifie l'auteur d'une question + les répondeurs précédents quand une
-- nouvelle réponse est postée sur le forum (sauf soi-même).
create or replace function public.notif_forum_reponse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;
drop trigger if exists trg_notif_forum on public.forum_reponses;
create trigger trg_notif_forum after insert on public.forum_reponses
  for each row execute function public.notif_forum_reponse();

-- Realtime pour la cloche.
alter publication supabase_realtime add table public.notifications;
