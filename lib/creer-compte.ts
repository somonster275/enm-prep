import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Crée un compte d'authentification + son profil applicatif.
 * email_confirm: true → la personne peut se connecter tout de suite avec le
 * mot de passe fourni (pas d'étape de confirmation email).
 * Lance une erreur en cas d'échec (et annule le compte auth si le profil échoue).
 */
export async function creerCompte({ email, nom, motDePasse, role }: {
  email: string
  nom?: string | null
  motDePasse: string
  role: 'editeur' | 'lecteur'
}): Promise<{ id: string }> {
  const admin = getSupabaseAdmin()

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { nom: nom || null },
  })
  if (authErr || !created?.user) {
    throw new Error(authErr?.message || 'Échec de la création du compte')
  }

  const { error: profErr } = await admin.from('profils').insert({
    id: created.user.id,
    email,
    nom: nom || null,
    role,
  })
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw new Error(`Profil : ${profErr.message}`)
  }

  return { id: created.user.id }
}
