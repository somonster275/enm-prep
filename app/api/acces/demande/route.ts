import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { envoyerEmailAdmin, escapeHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codex-prepa.vercel.app'

// Route PUBLIQUE (pas d'auth) : un visiteur demande un accès lecteur.
export async function POST(request: NextRequest) {
  const { nom, email, message } = await request.json().catch(() => ({}))
  const mail = String(email || '').trim().toLowerCase()
  if (!mail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }

  let admin
  try { admin = getSupabaseAdmin() } catch {
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
  }

  // Anti-doublon : une seule demande en attente par email.
  const { data: existante } = await admin
    .from('demandes_acces')
    .select('id')
    .eq('email', mail)
    .eq('statut', 'en_attente')
    .maybeSingle()
  if (existante) {
    return NextResponse.json({ ok: true, message: 'Ta demande est déjà enregistrée, elle sera examinée.' })
  }

  const nomPropre = String(nom || '').trim() || null
  const messagePropre = String(message || '').trim() || null

  const { error } = await admin.from('demandes_acces').insert({
    nom: nomPropre, email: mail, message: messagePropre,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notification email — non bloquante : la demande est enregistrée même si l'email échoue.
  try {
    await envoyerEmailAdmin(
      `Nouvelle demande d'accès — ${nomPropre || mail}`,
      `<div style="font-family:sans-serif;font-size:14px;color:#2A2018">
         <h2 style="margin:0 0 12px">Nouvelle demande d'accès lecteur</h2>
         <ul style="line-height:1.7">
           <li><b>Nom :</b> ${escapeHtml(nomPropre || '—')}</li>
           <li><b>Email :</b> ${escapeHtml(mail)}</li>
           <li><b>Message :</b> ${escapeHtml(messagePropre || '—')}</li>
         </ul>
         <p><a href="${APP_URL}/admin/utilisateurs" style="background:#DC4A2B;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Valider ou refuser</a></p>
       </div>`
    )
  } catch (e) {
    console.error('Email notification demande échouée:', e)
  }

  return NextResponse.json({ ok: true })
}
