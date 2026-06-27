import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Met à jour l'identité (nom + prénom) de l'utilisateur connecté.
// SÉCURITÉ : on n'écrit QUE nom/prenom — jamais le rôle. L'identité vient de la
// session validée, jamais d'un id fourni par le client.
export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { nom, prenom } = await request.json().catch(() => ({}))
  const nomPropre = typeof nom === 'string' ? nom.trim().slice(0, 80) : ''
  const prenomPropre = typeof prenom === 'string' ? prenom.trim().slice(0, 80) : ''

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('profils')
    .update({ nom: nomPropre || null, prenom: prenomPropre || null })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
