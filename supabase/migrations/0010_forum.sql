-- =====================================================================
--  Forum Q&R par matière (outil collaboratif)
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =====================================================================

create table if not exists public.forum_questions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  auteur     text,                    -- nom d'affichage (dénormalisé)
  matiere    text,                    -- matière concernée (texte libre / nom d'espace)
  titre      text not null,
  corps      text,
  created_at timestamptz not null default now()
);
create index if not exists forum_q_idx on public.forum_questions (created_at desc);

create table if not exists public.forum_reponses (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.forum_questions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  auteur      text,
  corps       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists forum_r_idx on public.forum_reponses (question_id, created_at);

alter table public.forum_questions enable row level security;
alter table public.forum_reponses enable row level security;

-- Lecture par tous les étudiants connectés ; écriture de ses propres contenus ;
-- suppression par l'auteur OU un admin (modération).
create policy "forum_q_select" on public.forum_questions for select to authenticated using (true);
create policy "forum_q_insert" on public.forum_questions for insert to authenticated with check (user_id = auth.uid());
create policy "forum_q_delete" on public.forum_questions for delete to authenticated
  using (user_id = auth.uid() or (select role from public.profils where id = auth.uid()) = 'admin');

create policy "forum_r_select" on public.forum_reponses for select to authenticated using (true);
create policy "forum_r_insert" on public.forum_reponses for insert to authenticated with check (user_id = auth.uid());
create policy "forum_r_delete" on public.forum_reponses for delete to authenticated
  using (user_id = auth.uid() or (select role from public.profils where id = auth.uid()) = 'admin');
