import { NextResponse, type NextRequest } from 'next/server'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Récupère le HTML d'une page externe pour en extraire un QCM.
// Réservé aux admins. Le parsing se fait côté client (DOMParser).
export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!(await estAdmin(user.id))) return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })

  const { url } = await request.json().catch(() => ({}))
  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'URL manquante' }, { status: 400 })

  let cible: URL
  try { cible = new URL(url.trim()) } catch { return NextResponse.json({ error: 'URL invalide' }, { status: 400 }) }

  // On n'autorise que le web public (anti-SSRF : pas de localhost / IP privées).
  if (!/^https?:$/.test(cible.protocol)) {
    return NextResponse.json({ error: 'Seules les URL http(s) sont acceptées.' }, { status: 400 })
  }
  const host = cible.hostname.toLowerCase()
  const prive =
    host === 'localhost' || host === '0.0.0.0' || host.endsWith('.local') ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '[::1]'
  if (prive) return NextResponse.json({ error: 'Adresse non autorisée.' }, { status: 400 })

  try {
    const res = await fetch(cible.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; codex-qcm-import)', Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return NextResponse.json({ error: `La page a répondu ${res.status}.` }, { status: 502 })
    const ctype = res.headers.get('content-type') || ''
    if (!/text\/html|application\/xhtml|text\/plain/i.test(ctype)) {
      return NextResponse.json({ error: `Type de contenu non supporté (${ctype || 'inconnu'}).` }, { status: 415 })
    }
    const html = await res.text()
    return NextResponse.json({ html: html.slice(0, 500_000) })
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'Délai dépassé.' : 'Impossible de récupérer la page.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
