import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codexprepa.com'

// Route PUBLIQUE : renvoie un lien d'invitation frais via l'admin SDK Supabase.
// On utilise le même mécanisme que l'invitation initiale (inviteUserByEmail) car
// il passe par l'email interne Supabase — pas soumis aux limites client public.
// Pour un utilisateur existant, Supabase renvoie simplement un nouveau token.
export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({}))
  const mail = String(email || '').trim().toLowerCase()

  if (!mail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
  }

  try {
    const admin = getSupabaseAdmin()

    // Vérifie que l'email correspond à un compte existant.
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const existe = users?.some(u => u.email === mail)

    if (existe) {
      // inviteUserByEmail renvoie un nouveau lien d'invitation même pour un
      // utilisateur existant — même chemin que l'invitation initiale.
      await admin.auth.admin.inviteUserByEmail(mail, {
        redirectTo: `${APP_URL}/bienvenue`,
      })
    }
    // Si l'email est inconnu on répond quand même ok : pas de divulgation.
  } catch {
    // Erreur silencieuse : l'utilisateur voit toujours le message de succès.
  }

  return NextResponse.json({ ok: true })
}
