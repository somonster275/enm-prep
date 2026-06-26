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

  // Supprime le profil applicatif puis le compte d'authentification.
  await admin.from('profils').delete().eq('id', id)
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
