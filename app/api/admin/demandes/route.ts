import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'
import { creerCompte } from '@/lib/creer-compte'
import { envoyerEmail, escapeHtml } from '@/lib/email'

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

  // Email au demandeur avec son mot de passe provisoire + lien de connexion.
  // ⚠️ Échoue tant qu'un domaine n'est pas vérifié dans Resend (mode test =
  // seul l'email du compte Resend est accepté). Non bloquant : le compte est créé.
  let emailEnvoye = false
  try {
    await envoyerEmail(
      dem.email,
      'Ton accès à codex est validé ✅',
      `<div style="font-family:sans-serif;font-size:14px;color:#2A2018;line-height:1.6">
         <h2 style="margin:0 0 12px">Bienvenue sur codex 🎓</h2>
         <p>Bonjour ${escapeHtml(dem.nom || '')},</p>
         <p>Ta demande d'accès a été <b>approuvée</b>. Voici tes identifiants provisoires :</p>
         <div style="background:#FFF8EE;border:1px solid #EADFC9;border-radius:8px;padding:12px 16px;margin:12px 0">
           <div>Email : <b>${escapeHtml(dem.email)}</b></div>
           <div>Mot de passe provisoire : <b>${escapeHtml(motDePasse)}</b></div>
         </div>
         <p><a href="${APP_URL}/login" style="background:#DC4A2B;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600">Me connecter</a></p>
         <p style="font-size:13px;color:#8A7E68">Après connexion, va dans <b>Mon compte</b> pour choisir ton mot de passe définitif.</p>
       </div>`
    )
    emailEnvoye = true
  } catch (e) {
    console.error('Email demandeur échoué:', e)
  }

  // On renvoie aussi les identifiants : si l'email n'a pu partir (domaine non
  // vérifié), l'admin peut les transmettre manuellement.
  return NextResponse.json({ ok: true, statut: 'approuve', email: dem.email, motDePasse, emailEnvoye })
}
