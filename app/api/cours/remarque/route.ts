import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { envoyerEmailAdmin, escapeHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codexprepa.com'

// Un étudiant envoie une remarque sur un cours → enregistrée + email à l'admin.
export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { coursId, message } = await request.json().catch(() => ({}))
  const msg = String(message || '').trim()
  if (!coursId || !msg) return NextResponse.json({ error: 'Remarque vide.' }, { status: 400 })

  const admin = getSupabaseAdmin()

  const { error } = await admin.from('cours_remarques').insert({
    cours_id: coursId, user_id: user.id, message: msg.slice(0, 2000),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notification email — non bloquante.
  try {
    const [{ data: cours }, { data: prof }] = await Promise.all([
      admin.from('cours').select('titre, matiere').eq('id', coursId).maybeSingle(),
      admin.from('profils').select('email, prenom, nom').eq('id', user.id).maybeSingle(),
    ])
    const auteur = prof ? ([prof.prenom, prof.nom].filter(Boolean).join(' ') || prof.email) : (user.email || 'Un étudiant')
    const localisation = cours ? `${cours.titre}${cours.matiere ? ` (${cours.matiere})` : ''}` : ''

    await envoyerEmailAdmin(
      `Remarque sur un cours — ${auteur}`,
      `<div style="font-family:sans-serif;font-size:14px;color:#2A2018">
         <h2 style="margin:0 0 12px">Nouvelle remarque sur un cours</h2>
         <ul style="line-height:1.7;padding-left:18px">
           <li><b>De :</b> ${escapeHtml(auteur)}${prof?.email ? ` (${escapeHtml(prof.email)})` : ''}</li>
           ${localisation ? `<li><b>Cours :</b> ${escapeHtml(localisation)}</li>` : ''}
         </ul>
         <p style="white-space:pre-wrap;border-left:3px solid #EADFC9;padding-left:12px;color:#3A352F">${escapeHtml(msg)}</p>
         <p><a href="${APP_URL}/cours" style="background:#DC4A2B;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Voir les cours</a></p>
       </div>`
    )
  } catch (e) {
    console.error('Email notification remarque cours échouée:', e)
  }

  return NextResponse.json({ ok: true })
}
