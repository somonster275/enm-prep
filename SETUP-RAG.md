# Mise en route — Questions de cours (RAG + 2 outils)

La page **« Questions de cours »** (`/cours-ia`) propose désormais un sélecteur :

- **Base ENM** — la grande base de cours, alimentée par les **admins**, interrogée par
  tous les étudiants. Recherche **sémantique (RAG)** : chaque passage est vectorisé
  (Voyage `voyage-law-2`, spécialisé droit) et la question retrouve les passages les
  plus proches par sens, pas seulement par mots-clés.
- **Mes documents** — chaque étudiant importe ses **propres** documents (privés) et les
  interroge. Recherche plein-texte (suffisant pour un petit volume personnel).

## Étapes pour activer

1. **Migration base de données.** Dans Supabase → SQL Editor, coller et exécuter
   `supabase/migrations/0002_rag_cours.sql`. (Active pgvector, ajoute la colonne
   `portee`, la colonne `embedding` et la fonction de recherche `match_cours_chunks`.)

2. **Variables d'environnement** (`.env.local`) :
   ```
   VOYAGE_API_KEY=...            # à créer sur https://www.voyageai.com
   VOYAGE_MODEL=voyage-law-2     # optionnel (défaut : voyage-law-2)
   # déjà nécessaires (existant) :
   ANTHROPIC_API_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. **Dépendances + lancement** : `npm install` puis `npm run dev`.
   (Aucune nouvelle dépendance npm : Voyage est appelé via `fetch`.)

4. **Alimenter la base ENM** : connecté en **admin**, onglet « Base ENM » →
   « + Importer » → PDF ou TXT. Chaque document officiel est vectorisé à l'import.

5. **Côté étudiant** : onglet « Mes documents » pour ajouter/interroger ses fichiers
   privés, onglet « Base ENM » pour interroger la base officielle.

## Confidentialité

L'identité provient de la **session (cookies)** côté serveur, jamais d'un `user_id`
envoyé par le client. Un étudiant ne peut voir ni interroger que ses propres documents
personnels (`portee = 'personnel'` + `created_by = lui`).

## Limites connues / pistes

- **Word (.docx) non géré** : l'import accepte seulement **PDF et TXT**. Convertir en
  PDF, ou ajouter l'extraction `.docx` (lib `mammoth`).
- **Documents officiels importés AVANT la migration** : ils n'ont pas d'embedding et
  seront ignorés par la recherche sémantique → les ré-importer (ou écrire un script de
  backfill qui embed les `cours_chunks` existants).
- **Coût embeddings** : un coût unique Voyage à l'import (négligeable par document,
  à surveiller sur des centaines de documents).
- **Seuil de pertinence** : sur les 8 passages les plus proches, seuls ceux de similarité
  ≥ 0.4 sont gardés (`SEUIL_SIMILARITE`, `app/api/cours/question/route.ts`) ; `hnsw.ef_search = 200`
  (migration 0044) évite qu'un filtre matière/documents ne vide les résultats.
- **Recherche hybride (base ENM)** : passages trouvés par le sens (embeddings, seuil 0.4) ET par les mots
  (`recherche_mots_cours`, plein-texte français classé par `ts_rank_cd`, migration 0046) ; fusion, sens d'abord,
  8 passages max. Un document est interrogeable par mots dès l'import, avant la fin des embeddings, et une
  limite de débit Voyage sur la question ne bloque plus la réponse.
- **Mes documents** : la même recherche par mots, restreinte à l'auteur. Découpage `lib/chunker.ts` (≈ 800 car.).
- **Indexation** : passages enregistrés à l'import, embeddings calculés ensuite par lots de 32 via
  `/api/cours/indexer` (bouton « Reprendre »). Offre gratuite Voyage ≈ 10 000 tokens/min : très lent sur un gros document.

## Ménage (fait le 2026-06-26)

Avant de comprendre que la fonctionnalité existait déjà, un système parallèle avait
été créé. Ces fichiers ont été **supprimés** car inutiles :

```
app/(app)/assistant/page.tsx          (supprimé)
app/api/assistant/route.ts            (supprimé)
scripts/ingest-cours.mjs              (supprimé)
supabase/migrations/0001_rag_documents.sql  (supprimé, remplacé par 0002_rag_cours.sql)
```

`lib/embeddings.ts` et `lib/auth-serveur.ts` sont, eux, **utilisés** par la solution
finale (`/api/cours/upload` et `/api/cours/question`) : conservés.
