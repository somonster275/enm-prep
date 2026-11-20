-- 0045 — Corrige 0044 : en plpgsql, RETURN QUERY exige des types identiques au résultat déclaré.
-- Les tables cours_* datent d'avant les migrations (nom / contenu possiblement en varchar) :
-- sans conversion explicite, chaque question à la base ENM échouait. Ré-exécutable.
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
  exception when others then null; -- réglage indisponible : la recherche marche quand même
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
end $$;
