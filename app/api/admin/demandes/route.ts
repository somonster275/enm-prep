import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codex-prepa.vercel.app'

async function garde() {
  const user = await utilisateurCourant()
  if (!user) return { erreur: 'Non authentifié', status: 401 as const }
  if (!(await estAdmin(user.id))) return { erreur: 'Réservé aux administrateurs', status: 403 as const }
  return { user }
}

// Liste les demandes en attente.
export async function GET() {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('demandes_acces')
    .select('*')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true })
  return NextResponse.json({ demandes: data || [] })
}

// Approuve (invite la personne) ou refuse une demande.
export async function POST(request: NextRequest) {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })

  const { id, action } = await request.json().catch(() => ({}))
  if (!id || (action !== 'approuver' && action !== 'refuser')) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: dem } = await admin.from('demandes_acces').select('*').eq('id', id).single()
  if (!dem) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (dem.statut !== 'en_attente') return NextResponse.json({ error: 'Demande déjà traitée' }, { status: 409 })

  const maj = { traite_at: new Date().toISOString(), traite_par: g.user.id }

  if (action === 'refuser') {
    await admin.from('demandes_acces').update({ statut: 'refuse', ...maj }).eq('id', id)
    return NextResponse.json({ ok: true, statut: 'refuse' })
  }

  // Approuver → on INVITE la personne via Supabase : elle reçoit un email avec un
  // lien pour définir elle-même son mot de passe (atterrit sur /bienvenue).
  // Supabase peut écrire à n'importe quelle adresse (pas la limite du mode test Resend).
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(dem.email, {
    data: { nom: dem.nom },
    redirectTo: `${APP_URL}/bienvenue`,
  })
  if (inviteErr || !invited?.user) {
    return NextResponse.json({ error: inviteErr?.message || "Échec de l'invitation" }, { status: 400 })
  }

  // Profil applicatif (rôle lecteur).
  const { error: profErr } = await admin.from('profils').insert({
    id: invited.user.id, email: dem.email, nom: dem.nom, role: 'lecteur',
  })
  if (profErr) {
    await admin.auth.admin.deleteUser(invited.user.id)
    return NextResponse.json({ error: `Profil : ${profErr.message}` }, { status: 500 })
  }

  await admin.from('demandes_acces').update({ statut: 'approuve', ...maj }).eq('id', id)
  return NextResponse.json({ ok: true, statut: 'approuve', email: dem.email, invite: true })
}
