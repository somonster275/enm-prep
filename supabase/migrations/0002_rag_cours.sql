-- =====================================================================
--  RAG sémantique pour la base de cours + séparation officiel/personnel
--  À exécuter dans Supabase : SQL Editor > coller > Run
--  (S'appuie sur les tables existantes cours_documents / cours_chunks)
-- =====================================================================

-- 1) Extension pgvector
create extension if not exists vector;

-- 2) Portée des documents : 'officiel' = base ENM (admins) / 'personnel' = docs d'un étudiant
alter table public.cours_documents
  add column if not exists portee text not null default 'officiel'
  check (portee in ('officiel', 'personnel'));

-- Les documents déjà présents sont considérés comme officiels (valeur par défaut).
create index if not exists cours_documents_portee_idx
  on public.cours_documents (portee);
create index if not exists cours_documents_createur_idx
  on public.cours_documents (created_by);

-- 3) Embedding des passages.
--    Dimension 1024 = Voyage voyage-law-2 (et voyage-3.x). Si tu changes de
--    modèle, adapte la dimension ET recrée l'index.
--    Seuls les passages OFFICIELS sont embeddés (les docs perso restent en
--    recherche plein-texte) → la colonne reste NULL pour le personnel.
alter table public.cours_chunks
  add column if not exists embedding vector(1024);

-- 4) Index de recherche vectorielle (HNSW, cosine). Les lignes sans embedding
--    (docs personnels) sont simplement ignorées par l'index.
create index if not exists cours_chunks_embedding_idx
  on public.cours_chunks
  using hnsw (embedding vector_cosine_ops);

-- 5) Recherche sémantique sur la BASE ENM (officiel uniquement).
--    Appelée côté serveur via supabase.rpc('match_cours_chunks', {...}).
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
language sql stable
as $$
  select
    c.contenu,
    d.id   as document_id,
    d.nom  as document_nom,
    1 - (c.embedding <=> query_embedding) as similarite
  from public.cours_chunks c
  join public.cours_documents d on d.id = c.document_id
  where d.portee = 'officiel'
    and d.deleted_at is null
    and c.embedding is not null
    and (filtre_espace    is null or d.espace_id  = filtre_espace)
    and (filtre_documents is null or c.document_id = any(filtre_documents))
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
