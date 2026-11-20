-- 0044 — Index et recherche (scan ECC). Ré-exécutable sans erreur, aucune donnée modifiée.
--  1) Recherche vectorielle filtrée (matière / documents choisis) : HNSW filtre APRÈS avoir pris
--     ef_search candidats (40 par défaut) → avec un filtre, il pouvait ne rester aucun passage.
--  2) Recherche plein-texte « Mes documents » : index GIN (sinon parcours complet de la table).
--  3) Clés étrangères sans index (suppressions en cascade, propager_nom, jointures).
--  4) Index en double (déjà couverts par une contrainte unique ou une clé primaire).
--  5) pauses : fin >= debut (NOT VALID : n'échoue pas sur d'éventuelles lignes existantes).

-- 1) ---------------------------------------------------------------
alter function public.match_cours_chunks(vector, int, uuid, uuid[]) set hnsw.ef_search = 200;

-- 2) ---------------------------------------------------------------
create index if not exists cours_chunks_fts_idx
  on public.cours_chunks using gin (to_tsvector('french', contenu));

-- 3) ---------------------------------------------------------------
do $$
declare r record;
begin
  for r in select * from (values
    ('forum_questions', 'user_id'), ('forum_reponses', 'user_id'), ('astuces', 'user_id'),
    ('annales', 'user_id'), ('qcm_resultats', 'qcm_id'), ('qcm_reponses', 'question_id'),
    ('media_vues', 'media_id'), ('favoris', 'fiche_id')
  ) as t(tbl, col) loop
    if to_regclass('public.' || r.tbl) is not null then
      execute format('create index if not exists %I on public.%I (%I)', r.tbl || '_' || r.col || '_idx', r.tbl, r.col);
    end if;
  end loop;
end $$;

-- 4) ---------------------------------------------------------------
drop index if exists public.matchs_code_idx;
drop index if exists public.match_joueurs_idx;

-- 5) ---------------------------------------------------------------
do $$
begin
  if to_regclass('public.pauses') is not null
     and not exists (select 1 from pg_constraint where conname = 'pauses_fin_apres_debut') then
    alter table public.pauses add constraint pauses_fin_apres_debut check (fin >= debut) not valid;
  end if;
end $$;
