import { NextResponse } from 'next/server'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { googleDisconnect } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'

export async function POST() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  await googleDisconnect(user.id)
  return NextResponse.json({ ok: true })
}
