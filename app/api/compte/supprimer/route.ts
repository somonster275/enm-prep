import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Droit à l'effacement (RGPD art. 17) : l'utilisateur supprime lui-même son
// compte et toutes ses données. L'identité vient de la session (jamais du client).
export async function POST() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const admin = getSupabaseAdmin()

  const del = async (table: string, col: string, val: string) => {
    try { await admin.from(table).delete().eq(col, val) } catch { /* table absente : on ignore */ }
  }

  // Efface les données applicatives (les tables avec FK ON DELETE CASCADE seront
  // de toute façon nettoyées par la suppression du compte ; on est exhaustif ici).
  await Promise.all([
    del('progression', 'utilisateur_id', user.id),
    del('activite_jours', 'utilisateur_id', user.id),
    del('notes', 'user_id', user.id),
    del('entraide', 'user_id', user.id),
    del('drive_liens', 'user_id', user.id),
    del('remarques_fiches', 'user_id', user.id),
    del('google_drive_tokens', 'user_id', user.id),
  ])
  if (user.email) await del('demandes_acces', 'email', user.email)

  // Documents importés « Mes documents » : passages (texte intégral) puis documents.
  const { data: docs } = await admin.from('cours_documents').select('id').eq('created_by', user.id).eq('portee', 'personnel')
  const docIds = (docs || []).map(d => d.id as string)
  if (docIds.length) {
    const { error: e1 } = await admin.from('cours_chunks').delete().in('document_id', docIds)
    const { error: e2 } = e1 ? { error: e1 } : await admin.from('cours_documents').delete().in('id', docIds)
    if (e2) return NextResponse.json({ error: 'Suppression des documents impossible, réessaie.' }, { status: 500 })
  }
  await del('profils', 'id', user.id)

  // Supprime le compte d'authentification lui-même.
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
