import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { envoyerEmailAdmin, escapeHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codexprepa.com'
const LIMITE_PAR_24H = 10 // propositions max par étudiant sur 24 h glissantes

type OptIn = { t: string; c?: boolean }
type QIn = { enonce: string; options: OptIn[]; explication?: string }

// Un étudiant propose une fiche ou un QCM → enregistré en file de modération + email admin.
export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const type = body?.type === 'qcm' ? 'qcm' : 'fiche'
  const admin = getSupabaseAdmin()

  // Anti-spam : cette route est le SEUL point d'entrée (la migration 0036 retire
  // l'insertion directe côté client), donc la limite ne peut pas être contournée.
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await admin.from('contributions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('created_at', depuis)
  if ((count ?? 0) >= LIMITE_PAR_24H) {
    return NextResponse.json({ error: `Limite de ${LIMITE_PAR_24H} propositions par 24 h atteinte. Réessaie demain.` }, { status: 429 })
  }

  let payload: Record<string, unknown>
  let titre = ''
  let matiere: string | null = null
  let espace_id: string | null = null
  let module_id: string | null = null

  if (type === 'fiche') {
    const question = String(body?.question || '').trim()
    const reponse = String(body?.reponse || '').trim()
    module_id = body?.moduleId || null
    espace_id = body?.espaceId || null
    if (!question || !reponse) return NextResponse.json({ error: 'Question et réponse requises.' }, { status: 400 })
    if (!module_id) return NextResponse.json({ error: 'Choisis un chapitre de destination.' }, { status: 400 })
    payload = { question: question.slice(0, 4000), reponse: reponse.slice(0, 8000) }
    titre = String(body?.titre || 'Fiche proposée').slice(0, 160)
  } else {
    matiere = String(body?.matiere || '').trim().slice(0, 80) || null
    titre = String(body?.titre || '').trim().slice(0, 160)
    const questionsIn: QIn[] = Array.isArray(body?.questions) ? body.questions : []
    // Ne garde que les questions valides : énoncé + ≥2 options + ≥1 bonne réponse.
    const questions = questionsIn
      .map(q => ({
        enonce: String(q?.enonce || '').trim().slice(0, 1000),
        options: (Array.isArray(q?.options) ? q.options : [])
          .map(o => ({ t: String(o?.t || '').trim().slice(0, 600), c: !!o?.c }))
          .filter(o => o.t),
        explication: q?.explication ? String(q.explication).trim().slice(0, 1000) : undefined,
      }))
      .filter(q => q.enonce && q.options.length >= 2 && q.options.some(o => o.c))
    if (!titre) return NextResponse.json({ error: 'Donne un titre au QCM.' }, { status: 400 })
    if (questions.length === 0) return NextResponse.json({ error: 'Ajoute au moins une question valide (énoncé, ≥2 options, ≥1 bonne réponse).' }, { status: 400 })
    payload = { questions }
  }

  const { error } = await admin.from('contributions').insert({
    user_id: user.id, type, statut: 'nouveau', titre, matiere, espace_id, module_id, payload,
  })
  if (error) { console.error('contributions:', error.message); return NextResponse.json({ error: 'Erreur serveur, réessaie.' }, { status: 500 }) }

  // Notification email — non bloquante.
  try {
    const { data: prof } = await admin.from('profils').select('email, prenom, nom').eq('id', user.id).maybeSingle()
    const auteur = prof ? ([prof.prenom, prof.nom].filter(Boolean).join(' ') || prof.email) : (user.email || 'Un étudiant')
    const nbQ = type === 'qcm' ? (payload.questions as unknown[]).length : 1
    await envoyerEmailAdmin(
      `Nouvelle contribution (${type}) — ${auteur}`,
      `<div style="font-family:sans-serif;font-size:14px;color:#2A2018">
         <h2 style="margin:0 0 12px">Nouvelle proposition de contenu</h2>
         <ul style="line-height:1.7;padding-left:18px">
           <li><b>De :</b> ${escapeHtml(auteur)}</li>
           <li><b>Type :</b> ${type === 'qcm' ? 'QCM' : 'Fiche'}</li>
           <li><b>Intitulé :</b> ${escapeHtml(titre)}</li>
           ${type === 'qcm' ? `<li><b>Questions :</b> ${nbQ}</li>` : ''}
         </ul>
         <p><a href="${APP_URL}/admin/contributions" style="background:#DC4A2B;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Modérer les contributions</a></p>
       </div>`
    )
  } catch (e) {
    console.error('Email notification contribution échouée:', e)
  }

  return NextResponse.json({ ok: true })
}
