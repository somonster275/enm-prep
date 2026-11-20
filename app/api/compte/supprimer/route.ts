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

  // supabase-js ne lève pas d'exception : on lit `error`. Table absente (migration non passée) = rien à effacer.
  const del = async (table: string, col: string, val: string) => {
    const { error } = await admin.from(table).delete().eq(col, val)
    if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw new Error(`${table}: ${error.message}`)
  }

  // Efface les données applicatives (les tables avec FK ON DELETE CASCADE seront
  // de toute façon nettoyées par la suppression du compte ; on est exhaustif ici).
  try {
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
  } catch (e) {
    console.error('compte/supprimer:', e)
    return NextResponse.json({ error: 'Suppression de tes données impossible, réessaie.' }, { status: 500 })
  }

  // Documents importés « Mes documents » : passages (texte intégral) puis documents.
  const { data: docs, error: eDocs } = await admin.from('cours_documents').select('id').eq('created_by', user.id).eq('portee', 'personnel')
  if (eDocs) return NextResponse.json({ error: 'Suppression des documents impossible, réessaie.' }, { status: 500 })
  const docIds = (docs || []).map(d => d.id as string)
  if (docIds.length) {
    const { error: e1 } = await admin.from('cours_chunks').delete().in('document_id', docIds)
    const { error: e2 } = e1 ? { error: e1 } : await admin.from('cours_documents').delete().in('id', docIds)
    if (e2) return NextResponse.json({ error: 'Suppression des documents impossible, réessaie.' }, { status: 500 })
  }
  // Compte d'authentification avant le profil : s'il échoue, la personne garde un compte cohérent.
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('compte/supprimer deleteUser:', error.message)
    return NextResponse.json({ error: 'Suppression du compte impossible, réessaie.' }, { status: 500 })
  }
  await admin.from('profils').delete().eq('id', user.id)

  return NextResponse.json({ ok: true })
}
