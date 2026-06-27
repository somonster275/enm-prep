import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { envoyerEmailAdmin, escapeHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codexprepa.com'

// Enlève les balises HTML d'une fiche pour l'aperçu dans l'email.
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// Un étudiant envoie une remarque sur une fiche → enregistrée + email à l'admin.
export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { ficheId, message } = await request.json().catch(() => ({}))
  const msg = String(message || '').trim()
  if (!ficheId || !msg) return NextResponse.json({ error: 'Remarque vide.' }, { status: 400 })

  const admin = getSupabaseAdmin()

  const { error } = await admin.from('remarques_fiches').insert({
    fiche_id: ficheId, user_id: user.id, message: msg.slice(0, 2000),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notification email — non bloquante : la remarque est enregistrée même si l'email échoue.
  try {
    const [{ data: fiche }, { data: prof }] = await Promise.all([
      admin.from('fiches').select('question, modules(nom, espaces(nom))').eq('id', ficheId).maybeSingle(),
      admin.from('profils').select('email, prenom, nom').eq('id', user.id).maybeSingle(),
    ])
    const auteur = prof ? ([prof.prenom, prof.nom].filter(Boolean).join(' ') || prof.email) : (user.email || 'Un étudiant')
    const mod = fiche?.modules as { nom?: string; espaces?: { nom?: string } } | null
    const localisation = mod ? `${mod.espaces?.nom ? mod.espaces.nom + ' › ' : ''}${mod.nom ?? ''}` : ''
    const apercu = fiche?.question ? stripHtml(fiche.question).slice(0, 200) : ''

    await envoyerEmailAdmin(
      `Nouvelle remarque — ${auteur}`,
      `<div style="font-family:sans-serif;font-size:14px;color:#2A2018">
         <h2 style="margin:0 0 12px">Nouvelle remarque d'un étudiant</h2>
         <ul style="line-height:1.7;padding-left:18px">
           <li><b>De :</b> ${escapeHtml(auteur)}${prof?.email ? ` (${escapeHtml(prof.email)})` : ''}</li>
           ${localisation ? `<li><b>Matière / module :</b> ${escapeHtml(localisation)}</li>` : ''}
           ${apercu ? `<li><b>Fiche :</b> ${escapeHtml(apercu)}</li>` : ''}
         </ul>
         <p style="white-space:pre-wrap;border-left:3px solid #EADFC9;padding-left:12px;color:#3A352F">${escapeHtml(msg)}</p>
         <p><a href="${APP_URL}/admin/remarques" style="background:#DC4A2B;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Voir les remarques</a></p>
       </div>`
    )
  } catch (e) {
    console.error('Email notification remarque échouée:', e)
  }

  return NextResponse.json({ ok: true })
}
