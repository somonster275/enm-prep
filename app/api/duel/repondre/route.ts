import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

const POINTS_BASE = 100
const POINTS_VITESSE = 50

// Corrige une réponse côté serveur : le client n'a jamais les bonnes réponses
// ni le droit d'écrire son score. Anti-rejeu via la clé (match, user, question)
// et fenêtre temporelle (on ne note que la question courante).
export async function POST(req: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { code, qIndex, choix } = await req.json().catch(() => ({}))
  const admin = getSupabaseAdmin()

  const { data: m } = await admin.from('matchs')
    .select('id, statut, deck, secondes_par_question, started_at')
    .eq('code', String(code || '').toUpperCase()).maybeSingle()
  if (!m) return NextResponse.json({ error: 'Match introuvable' }, { status: 404 })
  if (m.statut !== 'en_cours' || !m.started_at) return NextResponse.json({ error: 'Match non démarré' }, { status: 409 })

  const total = (m.deck as unknown[]).length
  const secs = m.secondes_par_question as number
  const elapsed = (Date.now() - Date.parse(m.started_at as string)) / 1000
  const curIdx = Math.floor(elapsed / secs)

  const qi = Number(qIndex)
  if (!Number.isInteger(qi) || qi < 0 || qi >= total) return NextResponse.json({ error: 'Question invalide' }, { status: 400 })
  // Fenêtre anti-triche : on ne note que la question courante (tolérance 1 pour la bascule).
  if (qi > curIdx || qi < curIdx - 1) return NextResponse.json({ error: 'Hors fenêtre' }, { status: 409 })

  const { data: sol } = await admin.from('match_solutions').select('solutions').eq('match_id', m.id).maybeSingle()
  const correct: number[] = (sol?.solutions?.[qi]) || []
  const choixArr: number[] = Array.isArray(choix) ? choix.filter((n: unknown) => Number.isInteger(n)) : []
  const juste = choixArr.length > 0 && choixArr.length === correct.length && correct.every(c => choixArr.includes(c))

  const reste = qi === curIdx ? Math.max(0, secs - (elapsed % secs)) : 0
  const points = juste ? POINTS_BASE + Math.round(POINTS_VITESSE * Math.max(0, Math.min(1, reste / secs))) : 0

  // Enregistre la réponse ; un doublon (déjà répondu) est rejeté par la clé primaire.
  const { error: insErr } = await admin.from('match_reponses')
    .insert({ match_id: m.id, user_id: user.id, q_index: qi, juste, points, choix: choixArr })
  if (insErr) return NextResponse.json({ ok: true, deja: true })

  // Recalcule le score agrégé du joueur depuis ses réponses (robuste).
  const { data: reps } = await admin.from('match_reponses')
    .select('juste, points').eq('match_id', m.id).eq('user_id', user.id)
  const agg = (reps || []).reduce(
    (a, r) => ({ score: a.score + (r.points as number), justes: a.justes + (r.juste ? 1 : 0), repondu: a.repondu + 1 }),
    { score: 0, justes: 0, repondu: 0 },
  )
  await admin.from('match_joueurs')
    .update({ score: agg.score, justes: agg.justes, repondu: agg.repondu })
    .eq('match_id', m.id).eq('user_id', user.id)

  // Auto-clôture si le temps total est écoulé (même si l'hôte a quitté).
  if (curIdx >= total - 1 && elapsed >= total * secs) {
    await admin.from('matchs').update({ statut: 'termine', ended_at: new Date().toISOString() })
      .eq('id', m.id).neq('statut', 'termine')
  }
  return NextResponse.json({ ok: true, juste, points })
}
