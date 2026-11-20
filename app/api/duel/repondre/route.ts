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

  // select('*') pour inclure mode/expire_at s'ils existent (migration 0033) sans
  // échouer s'ils sont absents (les duels temps réel restent inchangés).
  const { data: m } = await admin.from('matchs')
    .select('*')
    .eq('code', String(code || '').toUpperCase()).maybeSingle()
  if (!m) return NextResponse.json({ error: 'Match introuvable' }, { status: 404 })

  // Seuls les joueurs inscrits au match peuvent répondre (sinon le code suffirait à obtenir les corrections).
  const { data: joueur } = await admin.from('match_joueurs')
    .select('user_id').eq('match_id', m.id).eq('user_id', user.id).maybeSingle()
  if (!joueur) return NextResponse.json({ error: 'Tu ne participes pas à ce duel' }, { status: 403 })

  const async = m.mode === 'async'
  if (async) {
    // Duel asynchrone : pas d'horloge partagée, mais une date limite pour rejouer.
    if (m.expire_at && Date.parse(m.expire_at as string) < Date.now()) {
      return NextResponse.json({ error: 'Duel expiré' }, { status: 409 })
    }
  } else {
    if (m.statut !== 'en_cours' || !m.started_at) return NextResponse.json({ error: 'Match non démarré' }, { status: 409 })
  }

  const total = (m.deck as unknown[]).length
  const secs = m.secondes_par_question as number
  const elapsed = m.started_at ? (Date.now() - Date.parse(m.started_at as string)) / 1000 : 0
  const curIdx = Math.floor(elapsed / secs)

  const qi = Number(qIndex)
  if (!Number.isInteger(qi) || qi < 0 || qi >= total) return NextResponse.json({ error: 'Question invalide' }, { status: 400 })
  // Fenêtre anti-triche (temps réel uniquement) : on ne note que la question courante.
  // En async, chacun joue à son rythme → pas de fenêtre (l'anti-rejeu par clé primaire suffit).
  if (!async && (qi > curIdx || qi < curIdx - 1)) return NextResponse.json({ error: 'Hors fenêtre' }, { status: 409 })

  const { data: sol, error: solErr } = await admin.from('match_solutions').select('solutions').eq('match_id', m.id).maybeSingle()
  // Sans les solutions, une bonne réponse serait notée fausse puis verrouillée par l'anti-rejeu.
  if (solErr) return NextResponse.json({ error: 'Correction indisponible, réessaie' }, { status: 500 })
  const correct: number[] = (sol?.solutions?.[qi]) || []
  const choixArr: number[] = Array.isArray(choix) ? choix.filter((n: unknown) => Number.isInteger(n)) : []
  const juste = choixArr.length > 0 && choixArr.length === correct.length && correct.every(c => choixArr.includes(c))

  // En async : points fixes (pas de bonus vitesse, faute d'horloge fiable partagée).
  const reste = qi === curIdx ? Math.max(0, secs - (elapsed % secs)) : 0
  const points = juste
    ? (async ? POINTS_BASE : POINTS_BASE + Math.round(POINTS_VITESSE * Math.max(0, Math.min(1, reste / secs))))
    : 0

  // Enregistre la réponse ; un doublon (déjà répondu) est rejeté par la clé primaire.
  const { error: insErr } = await admin.from('match_reponses')
    .insert({ match_id: m.id, user_id: user.id, q_index: qi, juste, points })
  if (insErr?.code === '23505') return NextResponse.json({ ok: true, deja: true })
  if (insErr) return NextResponse.json({ error: 'Réponse non enregistrée, réessaie' }, { status: 500 })
  // Mémorise les choix pour le débrief (best-effort : la colonne peut ne pas
  // exister si la migration 0026 n'est pas encore passée).
  await admin.from('match_reponses').update({ choix: choixArr })
    .eq('match_id', m.id).eq('user_id', user.id).eq('q_index', qi)
    .then(({ error: e }) => { if (e) console.warn('choix non stockés (migration 0026 ?):', e.message) })

  // Recalcule le score agrégé du joueur depuis ses réponses (robuste).
  const { data: reps } = await admin.from('match_reponses')
    .select('juste, points').eq('match_id', m.id).eq('user_id', user.id)
  const agg = (reps || []).reduce(
    (a, r) => ({ score: a.score + (r.points as number), justes: a.justes + (r.juste ? 1 : 0), repondu: a.repondu + 1 }),
    { score: 0, justes: 0, repondu: 0 },
  )
  const termine = async && agg.repondu >= total
  await admin.from('match_joueurs')
    .update({ score: agg.score, justes: agg.justes, repondu: agg.repondu, ...(termine ? { termine: true } : {}) })
    .eq('match_id', m.id).eq('user_id', user.id)

  // Auto-clôture temps réel : si le temps total est écoulé (même si l'hôte a quitté).
  if (!async && curIdx >= total - 1 && elapsed >= total * secs) {
    await admin.from('matchs').update({ statut: 'termine', ended_at: new Date().toISOString() })
      .eq('id', m.id).neq('statut', 'termine')
  }
  // En async, on renvoie la correction de CETTE question : le joueur a verrouillé sa
  // réponse (anti-rejeu), donc la révéler ne donne aucun avantage → feedback immédiat.
  return NextResponse.json({ ok: true, juste, points, ...(async ? { correct, termine } : {}) })
}
