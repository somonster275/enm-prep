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

  const { id, motDePasse } = await request.json().catch(() => ({}))
  if (!id || !motDePasse || String(motDePasse).length < 6) {
    return NextResponse.json({ error: 'Mot de passe trop court (6 caractères minimum).' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: cible } = await admin.from('profils').select('role').eq('id', id).single()
  if (!cible) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
  // Un admin ne peut pas changer le mot de passe d'un AUTRE admin (sinon il prend son compte).
  if (cible.role === 'admin' && id !== user.id) {
    return NextResponse.json({ error: "Impossible de changer le mot de passe d'un autre administrateur." }, { status: 403 })
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password: String(motDePasse) })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
