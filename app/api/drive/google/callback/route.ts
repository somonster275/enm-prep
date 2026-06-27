import { NextResponse, type NextRequest } from 'next/server'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { googleExchangeCode, googleSaveTokens, googleUserEmail } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codexprepa.com'

// Retour de Google : on vérifie le state, échange le code contre des jetons,
// récupère l'email du compte connecté, puis stocke le tout pour l'utilisateur.
export async function GET(req: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.redirect(new URL('/login', APP_URL))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('g_oauth_state')?.value

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL('/drive?google=err', APP_URL))
  }

  try {
    const tok = await googleExchangeCode(code)
    const email = await googleUserEmail(tok.access_token)
    await googleSaveTokens(user.id, { ...tok, email })
    const res = NextResponse.redirect(new URL('/drive?google=ok', APP_URL))
    res.cookies.delete('g_oauth_state')
    return res
  } catch {
    return NextResponse.redirect(new URL('/drive?google=err', APP_URL))
  }
}
