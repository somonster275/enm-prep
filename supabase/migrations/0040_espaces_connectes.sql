-- 0040 — Matières (espaces) lisibles uniquement par les utilisateurs connectés.
--
-- La policy héritée « lecture_espaces » (rôle public) laissait n'importe qui, SANS compte,
-- lister les matières via l'API REST avec la clé anon publique. Aucune page publique
-- n'en a besoin (accueil, /bienvenue, /methode, /login ne lisent pas cette table).
-- Ré-exécutable sans erreur.

alter table public.espaces enable row level security;

drop policy if exists "lecture_espaces" on public.espaces;

drop policy if exists "espaces_select_connectes" on public.espaces;
create policy "espaces_select_connectes" on public.espaces
  for select to authenticated using (true);
