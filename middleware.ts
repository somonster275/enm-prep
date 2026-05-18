import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')
  const token = req.cookies.get('sb-access-token')?.value || 
                req.cookies.get('sb-hoduewjiaowlvhkngoum-auth-token')?.value

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}