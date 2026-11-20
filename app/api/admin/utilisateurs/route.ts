import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

const ROLES = ['admin', 'editeur', 'lecteur']

async function garde() {
  const user = await utilisateurCourant()
  if (!user) return { erreur: 'Non authentifié', status: 401 as const }
  if (!(await estAdmin(user.id))) return { erreur: 'Réservé aux administrateurs', status: 403 as const }
  return { user }
}

// Liste tous les profils (le RLS ne laisse un client lire que le sien).
export async function GET() {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })
  const { data, error } = await getSupabaseAdmin().from('profils').select('*').order('email')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ utilisateurs: data || [] })
}

// Change le rôle d'un utilisateur. Seul chemin possible : le RLS interdit toute
// modification de profils côté client.
export async function POST(request: NextRequest) {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })

  const { id, role } = await request.json().catch(() => ({}))
  if (!id || !ROLES.includes(role)) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  if (id === g.user.id) return NextResponse.json({ error: 'Tu ne peux pas changer ton propre rôle.' }, { status: 400 })

  const { data: cible } = await getSupabaseAdmin().from('profils').select('role').eq('id', id).maybeSingle()
  if (cible?.role === 'admin') return NextResponse.json({ error: "Impossible de modifier le rôle d'un autre administrateur." }, { status: 403 })

  const { error } = await getSupabaseAdmin().from('profils').update({ role }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
