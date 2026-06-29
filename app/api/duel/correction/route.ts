import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

type Origine = { cat: 'qcm' | 'fiche'; ficheId?: string; qcmId?: string; qId?: string }
type DeckQ = { enonce: string; options: { t: string }[]; cat: string }

// Débrief de fin de duel pour le joueur courant : pour chaque question, l'énoncé,
// les options, la (les) bonne(s) réponse(s), son propre choix et s'il a eu juste.
// Range aussi les erreurs dans les cartes à réviser (fiches → carnet/répétition
// espacée ; QCM → « réviser mes erreurs »).
export async function POST(req: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { code } = await req.json().catch(() => ({}))
  const admin = getSupabaseAdmin()

  const { data: m } = await admin.from('matchs')
    .select('id, statut, deck, secondes_par_question, started_at')
    .eq('code', String(code || '').toUpperCase()).maybeSingle()
  if (!m) return NextResponse.json({ error: 'Match introuvable' }, { status: 404 })

  // On ne livre le débrief qu'une fois le match réellement terminé (ou son temps écoulé).
  const total = (m.deck as DeckQ[]).length
  const secs = m.secondes_par_question as number
  const elapsed = m.started_at ? (Date.now() - Date.parse(m.started_at as string)) / 1000 : 0
  const fini = m.statut === 'termine' || (m.started_at && elapsed >= total * secs)
  if (!fini) return NextResponse.json({ error: 'Match non terminé' }, { status: 409 })

  // On sélectionne « * » pour ne pas échouer si « origines » / « choix » n'existent
  // pas encore (migration 0026) : les champs optionnels sont lus défensivement.
  const [{ data: sol }, { data: reps }] = await Promise.all([
    admin.from('match_solutions').select('*').eq('match_id', m.id).maybeSingle(),
    admin.from('match_reponses').select('*').eq('match_id', m.id).eq('user_id', user.id),
  ])
  const solutions: number[][] = sol?.solutions || []
  const origines: Origine[] = sol?.origines || []
  const repByIdx = new Map<number, { juste: boolean; choix: number[] }>()
  for (const r of (reps || []) as { q_index: number; juste: boolean; choix: number[] | null }[]) {
    repByIdx.set(r.q_index, { juste: !!r.juste, choix: Array.isArray(r.choix) ? r.choix : [] })
  }

  const deck = m.deck as DeckQ[]
  const correction = deck.map((q, i) => {
    const rep = repByIdx.get(i)
    const correct = solutions[i] || []
    // Sans réponse enregistrée = non répondu (donc raté).
    const juste = rep?.juste ?? false
    return {
      enonce: q.enonce,
      cat: q.cat,
      options: q.options.map(o => o.t),
      correct,
      choix: rep?.choix ?? [],
      repondu: !!rep,
      juste,
    }
  })

  // --- Range les erreurs dans les cartes à réviser ---
  const fichesEnErreur: string[] = []
  const qcmRows: { user_id: string; question_id: string; qcm_id: string; juste: boolean }[] = []
  correction.forEach((c, i) => {
    const o = origines[i]
    if (!o) return
    if (o.cat === 'fiche' && o.ficheId && !c.juste) {
      fichesEnErreur.push(o.ficheId)
    } else if (o.cat === 'qcm' && o.qId && o.qcmId) {
      // On enregistre juste/faux : une bonne réponse retire la question des erreurs.
      qcmRows.push({ user_id: user.id, question_id: o.qId, qcm_id: o.qcmId, juste: c.juste })
    }
  })

  // Fiches ratées → progression « À revoir » (palier 0, due maintenant) : elles
  // apparaissent dans le carnet d'erreurs et reviennent vite en révision.
  if (fichesEnErreur.length) {
    const now = new Date().toISOString()
    const rows = [...new Set(fichesEnErreur)].map(fiche_id => ({
      utilisateur_id: user.id, fiche_id, niveau: 0, palier: 0,
      prochaine_revision: now, derniere_revision: now,
    }))
    await admin.from('progression').upsert(rows, { onConflict: 'utilisateur_id,fiche_id' })
  }
  if (qcmRows.length) {
    await admin.from('qcm_reponses').upsert(qcmRows, { onConflict: 'user_id,question_id' })
  }

  const nbErreurs = correction.filter(c => !c.juste).length
  return NextResponse.json({
    correction,
    nbErreurs,
    nbFichesRangees: new Set(fichesEnErreur).size,
    nbQcmRangees: qcmRows.filter(r => !r.juste).length,
  })
}
