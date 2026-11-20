import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Supprime un document de cours.
// - Personnel : seul son auteur peut le supprimer, et c'est DÉFINITIF (passages puis document),
//   pour qu'aucune donnée privée ne reste en base.
// - Officiel (base ENM) : admin uniquement, mise à la corbeille (deleted_at) comme avant.
export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 })

  const admin = getSupabaseAdmin()
  const { data: doc } = await admin.from('cours_documents')
    .select('id, portee, created_by').eq('id', id).maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  if (doc.portee === 'personnel') {
    if (doc.created_by !== user.id) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    const { error: eC } = await admin.from('cours_chunks').delete().eq('document_id', id)
    if (eC) return NextResponse.json({ error: eC.message }, { status: 500 })
    const { error: eD } = await admin.from('cours_documents').delete().eq('id', id)
    if (eD) return NextResponse.json({ error: eD.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!(await estAdmin(user.id))) return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  const { error } = await admin.from('cours_documents')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
