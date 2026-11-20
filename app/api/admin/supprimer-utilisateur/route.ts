import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await estAdmin(user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 })
  if (id === user.id) {
    return NextResponse.json({ error: 'Tu ne peux pas supprimer ton propre compte.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: cible } = await admin.from('profils').select('role').eq('id', id).maybeSingle()
  if (cible?.role === 'admin') return NextResponse.json({ error: 'Impossible de supprimer un autre administrateur.' }, { status: 403 })

  // Compte d'authentification d'abord : s'il échoue, la personne garde un profil cohérent.
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await admin.from('profils').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
