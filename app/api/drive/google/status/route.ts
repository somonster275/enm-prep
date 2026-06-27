import { NextResponse } from 'next/server'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { googleStatus, googleConfigure } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { connected, email } = await googleStatus(user.id)
  return NextResponse.json({ connected, email, configure: googleConfigure() })
}
