import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'

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

  let admin
  try { admin = getSupabaseAdmin() } catch {
    return NextResponse.json({ error: 'Clé service role manquante' }, { status: 500 })
  }

  // --- 1) Création du compte d'authentification ---
  // email_confirm: true → l'utilisateur peut se connecter immédiatement avec le
  // mot de passe fourni, sans étape de confirmation par email.
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: email.trim(),
    password: motDePasse,
    email_confirm: true,
    user_metadata: { nom: nom?.trim() || null },
  })
  if (authErr || !created?.user) {
    return NextResponse.json({ error: authErr?.message || "Échec de la création du compte" }, { status: 400 })
  }

  // --- 2) Profil applicatif associé ---
  const { error: profErr } = await admin.from('profils').insert({
    id: created.user.id,
    email: email.trim(),
    nom: nom?.trim() || null,
    role: roleValide,
  })
  if (profErr) {
    // On annule le compte auth pour ne pas laisser un utilisateur sans profil.
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: `Profil : ${profErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ id: created.user.id, email: email.trim(), role: roleValide })
}
