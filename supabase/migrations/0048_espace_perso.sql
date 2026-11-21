-- =====================================================================
--  Mon espace : copies personnelles des contenus officiels (façon Anki).
--  L'étudiant télécharge un module (fiches + cours), un QCM ou une mind map
--  dans son espace, puis le modifie pour lui seul. Les mises à jour de l'admin
--  lui sont proposées : ses éléments modifiés sont conservés.
--  À exécuter dans Supabase : SQL Editor > coller > Run (ré-exécutable).
-- =====================================================================

create table if not exists public.perso_modules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom         text not null,
  source_type text check (source_type in ('module', 'qcm', 'mindmap')),
  source_id   uuid,                       -- module / qcm / mind map officiel d'origine
  created_at  timestamptz not null default now()
);
create index if not exists perso_modules_user_idx on public.perso_modules (user_id, created_at desc);

create table if not exists public.perso_elements (
  id              uuid primary key default gen_random_uuid(),
  perso_module_id uuid not null references public.perso_modules(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type            text not null check (type in ('fiche', 'qcm_question', 'cours', 'mindmap')),
  source_id       uuid,                   -- élément officiel d'origine (null = ajouté par l'étudiant)
  contenu         jsonb not null,         -- version de l'étudiant
  origine         jsonb,                  -- version officielle au dernier téléchargement / mise à jour
  supprime        boolean not null default false, -- supprimé par l'étudiant (pour ne pas le reproposer)
  ordre           int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists perso_elements_module_idx on public.perso_elements (perso_module_id, ordre);

-- Progression de révision des fiches perso (même forme que `progression`,
-- fiche_id = id de l'élément perso) : repart de zéro sur une copie.
create table if not exists public.perso_progression (
  utilisateur_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fiche_id           uuid not null references public.perso_elements(id) on delete cascade,
  niveau             int not null,
  palier             int not null default 0,
  prochaine_revision timestamptz not null,
  derniere_revision  timestamptz,
  primary key (utilisateur_id, fiche_id)
);

alter table public.perso_modules     enable row level security;
alter table public.perso_elements    enable row level security;
alter table public.perso_progression enable row level security;

-- Chacun ne voit et ne modifie que son propre espace.
drop policy if exists "perso_modules_own" on public.perso_modules;
create policy "perso_modules_own" on public.perso_modules for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "perso_elements_own" on public.perso_elements;
create policy "perso_elements_own" on public.perso_elements for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.perso_modules m where m.id = perso_module_id and m.user_id = auth.uid()));

drop policy if exists "perso_progression_own" on public.perso_progression;
create policy "perso_progression_own" on public.perso_progression for all to authenticated
  using (utilisateur_id = auth.uid())
  with check (utilisateur_id = auth.uid() and exists (
    select 1 from public.perso_elements e where e.id = fiche_id and e.user_id = auth.uid()));

notify pgrst, 'reload schema';
