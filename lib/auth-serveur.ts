import { createSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Identifie l'utilisateur côté serveur à partir de la session (cookies).
 *
 * On NE FAIT JAMAIS confiance à un user_id fourni par le client :
 * l'identité vient de la session validée, ce qui garantit la confidentialité
 * des documents personnels.
 */
export async function utilisateurCourant(): Promise<{ id: string; email?: string } | null> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return { id: data.user.id, email: data.user.email ?? undefined }
}

/** Vrai si l'utilisateur a le rôle 'admin' dans la table profils. */
export async function estAdmin(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const { data } = await admin.from('profils').select('role').eq('id', userId).single()
  return data?.role === 'admin'
}
