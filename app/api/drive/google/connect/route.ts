import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { googleAuthUrl, googleConfigure } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codexprepa.com'

// Démarre le flux OAuth Google : pose un state anti-CSRF en cookie puis redirige
// vers l'écran de consentement Google.
export async function GET() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.redirect(new URL('/login', APP_URL))
  if (!googleConfigure()) {
    return NextResponse.redirect(new URL('/drive?google=config', APP_URL))
  }
  const state = randomUUID()
  const res = NextResponse.redirect(googleAuthUrl(state))
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  })
  return res
}
