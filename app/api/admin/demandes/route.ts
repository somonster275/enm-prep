import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'
import { creerCompte } from '@/lib/creer-compte'

export const dynamic = 'force-dynamic'

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

// Approuve (crée le compte lecteur) ou refuse une demande.
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

  // Approuver → créer le compte lecteur avec un mot de passe temporaire.
  const motDePasse = 'Lec-' + crypto.randomUUID().slice(0, 8)
  try {
    await creerCompte({ email: dem.email, nom: dem.nom, motDePasse, role: 'lecteur' })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
  await admin.from('demandes_acces').update({ statut: 'approuve', ...maj }).eq('id', id)

  // On renvoie les identifiants pour que l'admin les communique à la personne
  // (Resend en mode test ne peut pas écrire à une adresse tierce).
  return NextResponse.json({ ok: true, statut: 'approuve', email: dem.email, motDePasse })
}
