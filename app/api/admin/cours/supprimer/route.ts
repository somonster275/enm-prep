import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Supprime un cours (page Cours) : la ligne ET le fichier du bucket public « cours »,
// sinon le fichier resterait téléchargeable par son adresse.
export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await estAdmin(user.id))) return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })

  const { id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 })

  const admin = getSupabaseAdmin()
  const { data: cours, error } = await admin.from('cours').delete().eq('id', id).select('fichier_url').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!cours) return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 })

  const chemin = String(cours.fichier_url || '').split('/storage/v1/object/public/cours/')[1]
  if (chemin) {
    const { error: eS } = await admin.storage.from('cours').remove([decodeURIComponent(chemin.split('?')[0])])
    if (eS) console.error('admin/cours/supprimer storage:', eS.message) // la ligne est partie : on ne bloque pas
  }
  return NextResponse.json({ ok: true })
}
