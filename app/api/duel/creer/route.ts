import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { extraitLisible, texteComplet } from '@/lib/texte'

export const dynamic = 'force-dynamic'

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const genCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')

type OptIn = { t: string; c?: boolean }
type QIn = { enonce: string; options: OptIn[]; cat?: string; ficheId?: string; qcmId?: string; qId?: string }
type Origine = { cat: 'qcm' | 'fiche'; ficheId?: string; qcmId?: string; qId?: string }

// Crée un match : reçoit le paquet construit côté client (avec bonnes réponses),
// stocke un paquet PUBLIC sans les bonnes réponses + les solutions à part.
export async function POST(req: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { titre, deck, secondes } = await req.json().catch(() => ({}))
  if (!Array.isArray(deck)) return NextResponse.json({ error: 'Paquet invalide' }, { status: 400 })

  const pub: { enonce: string; options: { t: string }[]; cat: string; multi: boolean }[] = []
  const sols: number[][] = []
  const origines: Origine[] = []
  // Texte INTÉGRAL des options, conservé côté serveur pour le débrief (afficher
  // toute la carte au clic). Jamais envoyé dans le deck public de jeu.
  const optionsFull: string[][] = []
  for (const q of deck as QIn[]) {
    if (!q?.enonce || !Array.isArray(q.options) || q.options.length < 2) continue
    const correct = q.options.map((o, i) => (o.c ? i : -1)).filter(i => i >= 0)
    if (correct.length < 1) continue
    const cat = q.cat === 'qcm' ? 'qcm' : 'fiche'
    pub.push({
      // Deck de jeu : tronqué proprement (phrases entières) pour l'affichage live.
      enonce: extraitLisible(String(q.enonce), 320),
      options: q.options.map(o => ({ t: extraitLisible(String(o.t), 280) })),
      cat,
      multi: correct.length > 1, // indique qu'il y a plusieurs bonnes réponses (sans dire lesquelles)
    })
    sols.push(correct)
    optionsFull.push(q.options.map(o => texteComplet(String(o.t), 4000)))
    // Origine conservée côté serveur (jamais dans le deck public) pour le débrief
    // et le rangement des erreurs en révision.
    origines.push(cat === 'qcm'
      ? { cat, qcmId: q.qcmId, qId: q.qId }
      : { cat, ficheId: q.ficheId })
  }
  if (pub.length < 2) return NextResponse.json({ error: 'Pas assez de questions valides.' }, { status: 400 })

  const secs = Math.min(120, Math.max(5, parseInt(secondes) || 20))
  const admin = getSupabaseAdmin()

  let code = ''
  for (let i = 0; i < 6 && !code; i++) {
    const c = genCode()
    const { data, error } = await admin.from('matchs').insert({
      code: c, hote_id: user.id, titre: String(titre || 'Match').slice(0, 120),
      deck: pub, secondes_par_question: secs, statut: 'attente',
    }).select('id').single()
    if (!error && data) {
      // Les solutions DOIVENT être stockées (sinon impossible de corriger).
      await admin.from('match_solutions').insert({ match_id: data.id, solutions: sols })
      // Les origines + options complètes (pour le débrief) sont best-effort :
      // si les colonnes n'existent pas encore, on n'échoue pas.
      await admin.from('match_solutions').update({ origines, options_full: optionsFull }).eq('match_id', data.id)
        .then(({ error: e }) => { if (e) console.warn('origines/options_full non stockées (migrations 0026/0029 ?):', e.message) })
      code = c
    }
  }
  if (!code) return NextResponse.json({ error: 'Création impossible, réessaie.' }, { status: 500 })
  return NextResponse.json({ code })
}
