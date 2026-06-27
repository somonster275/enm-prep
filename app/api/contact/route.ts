import { NextResponse, type NextRequest } from 'next/server'
import { envoyerEmailAdmin, escapeHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Route PUBLIQUE : un visiteur/étudiant envoie un message à l'administrateur.
export async function POST(request: NextRequest) {
  const { nom, email, message } = await request.json().catch(() => ({}))
  const mail = String(email || '').trim()
  const msg = String(message || '').trim()
  const nomPropre = String(nom || '').trim()

  if (!msg) return NextResponse.json({ error: 'Écris un message.' }, { status: 400 })
  if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
  }

  try {
    await envoyerEmailAdmin(
      `Message de contact — ${nomPropre || mail || 'anonyme'}`,
      `<div style="font-family:sans-serif;font-size:14px;color:#2A2018">
         <h2 style="margin:0 0 12px">Nouveau message de contact</h2>
         <ul style="line-height:1.7">
           <li><b>Nom :</b> ${escapeHtml(nomPropre || '—')}</li>
           <li><b>Email :</b> ${escapeHtml(mail || '—')}</li>
         </ul>
         <p style="white-space:pre-wrap;border-left:3px solid #EADFC9;padding-left:12px;color:#3A352F">${escapeHtml(msg)}</p>
       </div>`
    )
  } catch {
    return NextResponse.json({ error: "L'envoi a échoué, réessaie plus tard." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
