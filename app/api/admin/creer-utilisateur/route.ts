import { NextResponse, type NextRequest } from 'next/server'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'
import { creerCompte } from '@/lib/creer-compte'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // --- Identité + droits : réservé aux admins ---
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await estAdmin(user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { email, nom, motDePasse, role } = await request.json()
  if (!email?.trim() || !motDePasse) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
  }
  // On n'autorise que les rôles créables depuis cette interface.
  const roleValide = role === 'editeur' || role === 'lecteur' ? role : 'lecteur'

  try {
    const { id } = await creerCompte({ email: email.trim(), nom: nom?.trim() || null, motDePasse, role: roleValide })
    return NextResponse.json({ id, email: email.trim(), role: roleValide })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}
