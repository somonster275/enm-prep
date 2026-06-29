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
async function fetchEmbeddings(textes: string[], type: VoyageInputType): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: textes, input_type: type }),
  })
  if (res.status === 429) {
    // Renvoie null pour signaler un rate-limit
    return null as unknown as number[][]
  }
  if (!res.ok) {
    throw new Error(`Erreur Voyage (${res.status}) : ${await res.text()}`)
  }
  const json = (await res.json()) as VoyageResponse
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

export async function embed(
  textes: string[],
  type: VoyageInputType = 'document',
): Promise<number[][]> {
  if (!VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY manquante (voir .env.local.example)')
  }
  if (textes.length === 0) return []

  // Retry avec backoff exponentiel sur 429 (free tier : 3 RPM)
  const MAX_TENTATIVES = 6
  let attente = 20_000 // 20 s pour passer sous la fenêtre de 1 min
  for (let i = 0; i < MAX_TENTATIVES; i++) {
    const result = await fetchEmbeddings(textes, type)
    if (result !== null) return result
    if (i < MAX_TENTATIVES - 1) {
      await new Promise(r => setTimeout(r, attente))
      attente = Math.min(attente * 1.5, 60_000)
    }
  }
  throw new Error('Voyage AI : limite de taux dépassée après plusieurs tentatives. Ajoute un moyen de paiement sur dashboard.voyageai.com pour débloquer les limites standard.')
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
