import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

async function garde() {
  const user = await utilisateurCourant()
  if (!user) return { erreur: 'Non authentifié', status: 401 as const }
  if (!(await estAdmin(user.id))) return { erreur: 'Réservé aux administrateurs', status: 403 as const }
  return { user }
}

type QOption = { t: string; c: boolean }
type QQuestion = { enonce: string; options: QOption[]; explication?: string }

// Liste les QCM existants (avec le nombre de questions).
export async function GET() {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })
  const admin = getSupabaseAdmin()
  const { data: qcms } = await admin.from('qcm').select('id, titre, matiere, created_at').order('created_at', { ascending: false })
  const { data: qs } = await admin.from('qcm_questions').select('qcm_id')
  const counts: Record<string, number> = {}
  for (const q of (qs || []) as { qcm_id: string }[]) counts[q.qcm_id] = (counts[q.qcm_id] || 0) + 1
  return NextResponse.json({ qcms: (qcms || []).map((q: { id: string }) => ({ ...q, nb: counts[q.id] || 0 })) })
}

// Crée un QCM avec ses questions.
export async function POST(request: NextRequest) {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })

  const { titre, matiere, questions } = await request.json().catch(() => ({}))
  if (!titre?.trim() || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'Titre et au moins une question requis.' }, { status: 400 })
  }
  const valides = (questions as QQuestion[]).filter(q =>
    q.enonce?.trim() && Array.isArray(q.options) && q.options.length >= 2 && q.options.some(o => o.c))
  if (valides.length === 0) {
    return NextResponse.json({ error: 'Chaque question doit avoir ≥ 2 options et au moins une bonne réponse.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: qcm, error } = await admin.from('qcm')
    .insert({ titre: titre.trim().slice(0, 160), matiere: matiere?.trim()?.slice(0, 60) || null })
    .select().single()
  if (error || !qcm) return NextResponse.json({ error: error?.message || 'Échec création' }, { status: 500 })

  const rows = valides.map((q, i) => ({
    qcm_id: qcm.id,
    enonce: q.enonce.trim(),
    options: q.options.map(o => ({ t: String(o.t).trim(), c: !!o.c })),
    explication: q.explication?.trim() || null,
    ordre: i,
  }))
  const { error: errQ } = await admin.from('qcm_questions').insert(rows)
  if (errQ) { await admin.from('qcm').delete().eq('id', qcm.id); return NextResponse.json({ error: errQ.message }, { status: 500 }) }

  return NextResponse.json({ ok: true, id: qcm.id, nb: rows.length })
}

// Supprime un QCM.
export async function DELETE(request: NextRequest) {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })
  const { id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })
  await getSupabaseAdmin().from('qcm').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
