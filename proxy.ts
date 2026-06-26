import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Valeurs publiques (URL + clé anon) avec secours en dur — identiques à lib/supabase.ts.
// En Edge, les variables NEXT_PUBLIC_* sont injectées au build ; si elles manquent
// (build sans env), le secours évite le crash « URL and Key are required ».
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hoduewjiaowlvhkngoum.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZHVld2ppYW93bHZoa25nb3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTY1MDEsImV4cCI6MjA5NDUzMjUwMX0._7BQ2UQteV8Mb-n8-hPQM56bZBDPbx5Oksx0Qo6RuCM'

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res = NextResponse.next({ request: req })
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            )
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = req.nextUrl.pathname
  const isAuthPage = path.startsWith('/login')
  // Routes accessibles sans être connecté : la page de connexion, le callback
  // d'auth Supabase, et la demande d'accès self-service (POST public).
  const estPublic = isAuthPage || path.startsWith('/auth') || path.startsWith('/api/acces')

  if (!user && !estPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
