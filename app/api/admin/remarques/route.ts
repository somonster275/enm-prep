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

// Liste les remarques (avec la fiche concernée et l'auteur).
export async function GET() {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })
  const admin = getSupabaseAdmin()

  const { data: rem } = await admin
    .from('remarques_fiches')
    .select('id, message, statut, created_at, fiche_id, user_id, fiches(question, modules(nom, espaces(nom, slug)))')
    .order('created_at', { ascending: false })
    .limit(300)

  const ids = [...new Set((rem || []).map((r: { user_id: string }) => r.user_id))]
  const { data: profs } = ids.length
    ? await admin.from('profils').select('id, email, prenom, nom').in('id', ids)
    : { data: [] as { id: string; email: string; prenom: string | null; nom: string | null }[] }
  const byId = Object.fromEntries((profs || []).map(p => [p.id, p]))

  const items = (rem || []).map((r: Record<string, unknown>) => ({ ...r, auteur: byId[r.user_id as string] || null }))
  return NextResponse.json({ remarques: items })
}

// Traite une remarque : marquer traité / rouvrir / supprimer.
export async function POST(request: NextRequest) {
  const g = await garde()
  if ('erreur' in g) return NextResponse.json({ error: g.erreur }, { status: g.status })

  const { id, action } = await request.json().catch(() => ({}))
  if (!id || !['traite', 'nouveau', 'supprimer'].includes(action)) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }
  const admin = getSupabaseAdmin()

  if (action === 'supprimer') {
    await admin.from('remarques_fiches').delete().eq('id', id)
  } else {
    await admin.from('remarques_fiches').update({ statut: action }).eq('id', id)
  }
  return NextResponse.json({ ok: true })
}
