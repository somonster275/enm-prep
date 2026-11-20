-- 0046 — Recherche plein-texte classée (ts_rank_cd) pour les cours : base ENM (recherche hybride avec les
-- embeddings, utilisable dès l'import) et « Mes documents ». Appelée par le serveur (service_role) uniquement :
-- p_user est fourni par le serveur depuis la session. Ré-exécutable.
create or replace function public.recherche_mots_cours(
  p_query          text,
  p_portee         text,
  p_user           uuid default null,
  filtre_espace    uuid default null,
  filtre_documents uuid[] default null,
  match_count      int default 8
)
returns table (contenu text, document_nom text, rang real)
language sql stable
as $$
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
$$;

revoke all on function public.recherche_mots_cours(text, text, uuid, uuid, uuid[], int) from public, anon, authenticated;
grant execute on function public.recherche_mots_cours(text, text, uuid, uuid, uuid[], int) to service_role;

notify pgrst, 'reload schema';
