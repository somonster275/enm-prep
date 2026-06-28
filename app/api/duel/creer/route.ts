import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const genCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')

type OptIn = { t: string; c?: boolean }
type QIn = { enonce: string; options: OptIn[]; cat?: string }

// Crée un match : reçoit le paquet construit côté client (avec bonnes réponses),
// stocke un paquet PUBLIC sans les bonnes réponses + les solutions à part.
export async function POST(req: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { titre, deck, secondes } = await req.json().catch(() => ({}))
  if (!Array.isArray(deck)) return NextResponse.json({ error: 'Paquet invalide' }, { status: 400 })

  const pub: { enonce: string; options: { t: string }[]; cat: string; multi: boolean }[] = []
  const sols: number[][] = []
  for (const q of deck as QIn[]) {
    if (!q?.enonce || !Array.isArray(q.options) || q.options.length < 2) continue
    const correct = q.options.map((o, i) => (o.c ? i : -1)).filter(i => i >= 0)
    if (correct.length < 1) continue
    pub.push({
      enonce: String(q.enonce).slice(0, 400),
      options: q.options.map(o => ({ t: String(o.t).slice(0, 300) })),
      cat: q.cat === 'qcm' ? 'qcm' : 'fiche',
      multi: correct.length > 1, // indique qu'il y a plusieurs bonnes réponses (sans dire lesquelles)
    })
    sols.push(correct)
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
      await admin.from('match_solutions').insert({ match_id: data.id, solutions: sols })
      code = c
    }
  }
  if (!code) return NextResponse.json({ error: 'Création impossible, réessaie.' }, { status: 500 })
  return NextResponse.json({ code })
}
