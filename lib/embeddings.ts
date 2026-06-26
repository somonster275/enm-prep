/**
 * Génération d'embeddings via Voyage AI (recommandé par Anthropic).
 *
 * ⚠️ Code SERVEUR uniquement (utilise VOYAGE_API_KEY). Ne jamais importer
 *    dans un composant client.
 *
 * Modèle par défaut : voyage-law-2 (spécialisé juridique, multilingue, 1024 dims)
 * — idéal pour le droit français. Configurable via VOYAGE_MODEL.
 * ⚠️ La dimension du modèle DOIT correspondre à la colonne vector(1024) de la
 *    table cours_chunks (migration 0002).
 */

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || 'voyage-law-2'

type VoyageInputType = 'query' | 'document'

interface VoyageResponse {
  data: { embedding: number[]; index: number }[]
}

/**
 * Calcule les embeddings d'un lot de textes.
 * @param textes  Liste de passages (ou une seule question).
 * @param type    'document' à l'ingestion, 'query' pour une question utilisateur.
 */
export async function embed(
  textes: string[],
  type: VoyageInputType = 'document',
): Promise<number[][]> {
  if (!VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY manquante (voir .env.local.example)')
  }
  if (textes.length === 0) return []

  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: textes, input_type: type }),
  })

  if (!res.ok) {
    throw new Error(`Erreur Voyage (${res.status}) : ${await res.text()}`)
  }

  const json = (await res.json()) as VoyageResponse
  // Réordonne par index pour garantir l'alignement avec l'entrée.
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

/** Embedding d'une seule question (raccourci, input_type = 'query'). */
export async function embedQuestion(question: string): Promise<number[]> {
  const [v] = await embed([question], 'query')
  return v
}

/** Format texte attendu par pgvector : '[0.1,0.2,...]'. */
export function toVector(arr: number[]): string {
  return `[${arr.join(',')}]`
}
