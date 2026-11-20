-- 0044 — Index et recherche (scan ECC). Ré-exécutable sans erreur, aucune donnée modifiée.
--  1) Recherche vectorielle filtrée (fonction réécrite à l'identique + set_config) (matière / documents choisis) : HNSW filtre APRÈS avoir pris
--     ef_search candidats (40 par défaut) → avec un filtre, il pouvait ne rester aucun passage.
--  2) Recherche plein-texte « Mes documents » : index GIN (sinon parcours complet de la table).
--  3) Clés étrangères sans index (suppressions en cascade, propager_nom, jointures).
--  4) Index en double (déjà couverts par une contrainte unique ou une clé primaire).
--  5) pauses : fin >= debut (NOT VALID : n'échoue pas sur d'éventuelles lignes existantes).

-- 1) ---------------------------------------------------------------
-- `alter function ... set hnsw.ef_search` est refusé sur Supabase (paramètre réservé au superutilisateur) :
-- la fonction le règle elle-même pour sa transaction (set_config local), ce qui est permis à tout rôle.
create or replace function public.match_cours_chunks(
  query_embedding  vector(1024),
  match_count      int default 8,
  filtre_espace    uuid default null,
  filtre_documents uuid[] default null
)
returns table (
  contenu       text,
  document_id   uuid,
  document_nom  text,
  similarite    float
)
language plpgsql
as $$
begin
  begin
    perform set_config('hnsw.ef_search', '200', true);
  exception when others then null; -- réglage indisponible : la recherche marche quand même (40 candidats)
  end;
  return query
  select
    c.contenu,
    d.id   as document_id,
    d.nom  as document_nom,
    (1 - (c.embedding <=> query_embedding))::float as similarite
  from public.cours_chunks c
  join public.cours_documents d on d.id = c.document_id
  where d.portee = 'officiel'
    and d.deleted_at is null
    and c.embedding is not null
    and (filtre_espace    is null or d.espace_id  = filtre_espace)
    and (filtre_documents is null or c.document_id = any(filtre_documents))
  order by c.embedding <=> query_embedding
  limit match_count;
end $$;

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
