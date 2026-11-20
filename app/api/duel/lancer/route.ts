import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Lance un duel : seul l'hôte, seulement depuis le salon d'attente, et le serveur
// fixe l'heure de départ. Remplace l'update client (policy matchs_update retirée en 0043).
export async function POST(req: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { code } = await req.json().catch(() => ({}))
  const { data, error } = await getSupabaseAdmin().from('matchs')
    .update({ statut: 'en_cours', started_at: new Date().toISOString() })
    .eq('code', String(code || '').toUpperCase()).eq('hote_id', user.id).eq('statut', 'attente')
    .select('id')
  if (error) return NextResponse.json({ error: 'Lancement impossible, réessaie' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Duel introuvable ou déjà lancé' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
