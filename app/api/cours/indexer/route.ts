import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'
import { embed, toVector } from '@/lib/embeddings'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LOT = 32 // ≈ 6 000 tokens : passe aussi sous la limite gratuite Voyage (10 000 tokens/min), un seul appel par lot

// Calcule les embeddings du lot suivant d'un document de la base ENM. Appelée en boucle par la page
// jusqu'à `restants: 0` ; reprise possible à tout moment (seuls les passages sans embedding sont traités).
export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await estAdmin(user.id))) return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })

  const { id } = await request.json().catch(() => ({}))
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 })

  const admin = getSupabaseAdmin()
  const { data: lot, error } = await admin.from('cours_chunks')
    .select('id, contenu').eq('document_id', id).is('embedding', null).order('position').limit(LOT)
  if (error) { console.error('cours/indexer:', error.message); return NextResponse.json({ error: 'Lecture des passages impossible.' }, { status: 500 }) }

  if (lot?.length) {
    let vecteurs: number[][]
    try {
      vecteurs = await embed(lot.map(c => c.contenu as string), 'document', 1)
    } catch (e) {
      console.error('cours/indexer embeddings:', e)
      const limite = String(e).includes('limite de taux')
      return NextResponse.json({ error: limite ? 'Limite Voyage atteinte' : 'Voyage indisponible', attendre: limite }, { status: limite ? 429 : 502 })
    }
    const res = await Promise.all(lot.map((c, i) =>
      admin.from('cours_chunks').update({ embedding: toVector(vecteurs[i]) }).eq('id', c.id)))
    const eMaj = res.find(r => r.error)?.error
    if (eMaj) { console.error('cours/indexer maj:', eMaj.message); return NextResponse.json({ error: 'Enregistrement des embeddings impossible.' }, { status: 500 }) }
  }

  const { count, error: eC } = await admin.from('cours_chunks')
    .select('id', { count: 'exact', head: true }).eq('document_id', id).is('embedding', null)
  if (eC) return NextResponse.json({ error: 'Comptage impossible.' }, { status: 500 })
  return NextResponse.json({ restants: count ?? 0 })
}
