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

type Contribution = {
  id: string; user_id: string; type: string; statut: string; titre: string | null
  matiere: string | null; espace_id: string | null; module_id: string | null
  payload: { question?: string; reponse?: string; questions?: { enonce: string; options: { t: string; c: boolean }[]; explication?: string }[] }
}

// Liste les contributions (avec l'auteur), les plus récentes d'abord.
export async function GET() {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })
  const admin = getSupabaseAdmin()

  const { data: contribs } = await admin.from('contributions')
    .select('*').order('created_at', { ascending: false }).limit(300)
  const ids = [...new Set((contribs || []).map((c: { user_id: string }) => c.user_id))]
  const { data: profs } = ids.length
    ? await admin.from('profils').select('id, email, prenom, nom').in('id', ids)
    : { data: [] as { id: string; email: string; prenom: string | null; nom: string | null }[] }
  const byId = Object.fromEntries((profs || []).map(p => [p.id, p]))
  const items = (contribs || []).map((c: Record<string, unknown>) => ({ ...c, auteur: byId[c.user_id as string] || null }))
  return NextResponse.json({ contributions: items })
}

// Modère une contribution : approuver (crée le contenu) / refuser / supprimer.
export async function POST(request: NextRequest) {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })

  const { id, action } = await request.json().catch(() => ({}))
  if (!id || !['approuver', 'refuser', 'supprimer'].includes(action)) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }
  const admin = getSupabaseAdmin()

  if (action === 'supprimer') {
    await admin.from('contributions').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }
  if (action === 'refuser') {
    await admin.from('contributions').update({ statut: 'refuse' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // --- Approbation : on crée réellement le contenu, puis on marque « approuve ». ---
  const { data: c } = await admin.from('contributions').select('*').eq('id', id).maybeSingle()
  if (!c) return NextResponse.json({ error: 'Contribution introuvable' }, { status: 404 })
  const contrib = c as Contribution
  if (contrib.statut === 'approuve') return NextResponse.json({ ok: true, deja: true })

  if (contrib.type === 'fiche') {
    if (!contrib.module_id) return NextResponse.json({ error: 'Aucun chapitre de destination.' }, { status: 400 })
    const { question, reponse } = contrib.payload
    const { error } = await admin.from('fiches').insert({ module_id: contrib.module_id, question, reponse })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const questions = contrib.payload.questions || []
    if (questions.length === 0) return NextResponse.json({ error: 'QCM vide.' }, { status: 400 })
    const { data: qcm, error: eQ } = await admin.from('qcm')
      .insert({ titre: contrib.titre || 'QCM', matiere: contrib.matiere, type: 'choix' })
      .select('id').single()
    if (eQ || !qcm) return NextResponse.json({ error: eQ?.message || 'Création du QCM impossible.' }, { status: 500 })
    const rows = questions.map((q, i) => ({
      qcm_id: qcm.id, enonce: q.enonce, options: q.options, explication: q.explication || null, ordre: i,
    }))
    const { error: eR } = await admin.from('qcm_questions').insert(rows)
    if (eR) return NextResponse.json({ error: eR.message }, { status: 500 })
  }

  await admin.from('contributions').update({ statut: 'approuve' }).eq('id', id)
  return NextResponse.json({ ok: true })
}
