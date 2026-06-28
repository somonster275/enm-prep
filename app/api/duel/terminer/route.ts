import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Clôt un match quand son temps total est écoulé. N'importe quel participant
// peut l'appeler (pas seulement l'hôte) → plus de match « fantôme » si l'hôte
// quitte. Le serveur vérifie que le temps est bien écoulé avant de clôturer.
export async function POST(req: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { code } = await req.json().catch(() => ({}))
  const admin = getSupabaseAdmin()

  const { data: m } = await admin.from('matchs')
    .select('id, statut, deck, secondes_par_question, started_at')
    .eq('code', String(code || '').toUpperCase()).maybeSingle()
  if (!m) return NextResponse.json({ error: 'Match introuvable' }, { status: 404 })
  if (m.statut === 'termine') return NextResponse.json({ ok: true })
  if (!m.started_at) return NextResponse.json({ error: 'Match non démarré' }, { status: 409 })

  const total = (m.deck as unknown[]).length
  const secs = m.secondes_par_question as number
  const elapsed = (Date.now() - Date.parse(m.started_at as string)) / 1000
  if (elapsed < total * secs) return NextResponse.json({ error: 'Match en cours' }, { status: 409 })

  await admin.from('matchs').update({ statut: 'termine', ended_at: new Date().toISOString() })
    .eq('id', m.id).neq('statut', 'termine')
  return NextResponse.json({ ok: true })
}
