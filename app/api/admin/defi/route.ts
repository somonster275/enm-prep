import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Met à jour la configuration du défi de la semaine (admin uniquement).
export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await estAdmin(user.id))) return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })

  const { type, titre, description, objectif, matiere } = await request.json().catch(() => ({}))
  const typeValide = type === 'libre' ? 'libre' : 'fiches'
  const obj = Math.max(1, Math.min(100000, parseInt(objectif, 10) || 150))

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('defi_config').upsert({
    id: 1,
    type: typeValide,
    titre: (titre ?? '').toString().trim().slice(0, 120) || null,
    description: (description ?? '').toString().trim().slice(0, 600) || null,
    objectif: obj,
    matiere: (matiere ?? '').toString().trim().slice(0, 60) || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
