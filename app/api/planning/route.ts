import { NextResponse, type NextRequest } from 'next/server'

/**
 * Récupère un planning extraplanning (ex. IEJ Panthéon) rendu en HTML, côté serveur
 * (contourne le CORS), et le convertit en événements pour le calendrier.
 *
 * La page n'affiche qu'un mois à la fois et navigue par postback ASP.NET. On enchaîne
 * donc : GET (mois courant) → POST « mois suivant » ×N, en conservant le cookie de
 * session et le __VIEWSTATE de chaque réponse.
 *
 * Entrée  : { feeds: [{ url, nom, couleur }] }
 * Sortie  : { evenements: [{ date_debut, heure, fin, titre, type, lieu, intervenant, formation, couleur, source, lien }] }
 */

type Feed = { url: string; nom: string; couleur: string }
type Ev = {
  date_debut: string; heure: string; fin: string
  titre: string; type: string; lieu: string; intervenant: string; formation: string
  couleur: string; source: string; lien: string
}

const MOIS_AVANT = 4          // mois courant + 3 suivants
const TTL = 30 * 60 * 1000    // cache mémoire 30 min

const MOIS: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, 'décembre': 12, decembre: 12,
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

// Cache mémoire simple (par URL) pour ne pas solliciter le planning à chaque chargement.
const cache = new Map<string, { t: number; evs: Ev[] }>()

const decode = (s: string) =>
  (s || '')
    .replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const clean = (s: string) => decode(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

function champCache(html: string, name: string): string {
  const re = new RegExp(`name="${name.replace(/\$/g, '\\$')}"[^>]*?value="([^"]*)"`, 'i')
  return (html.match(re) || [])[1] || ''
}

function parseDateFr(txt: string): string | null {
  const m = txt.match(/(\d{1,2})\s+([^\s<]+)\s+(\d{4})/)
  if (!m) return null
  const mois = MOIS[m[2].toLowerCase()]
  if (!mois) return null
  return `${m[3]}-${String(mois).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`
}

function parseEvenements(html: string, feed: Feed): Ev[] {
  const out: Ev[] = []
  const jours: { pos: number; iso: string }[] = []
  const dayRe = /<h4 class="jour">([^<]+)<\/h4>/g
  let m: RegExpExecArray | null
  while ((m = dayRe.exec(html))) {
    const iso = parseDateFr(decode(m[1]))
    if (iso) jours.push({ pos: m.index, iso })
  }
  const evRe = /<h5 class="heure">\s*([0-9]{1,2}:[0-9]{2})\s*-\s*([0-9]{1,2}:[0-9]{2})\s*<\/h5>\s*<\/div>\s*<div class="col-md-10"[^>]*>([\s\S]*?)<\/div>/g
  while ((m = evRe.exec(html))) {
    const debut = m[1], fin = m[2], inner = m[3]
    let iso: string | null = null
    for (const d of jours) { if (d.pos < m.index) iso = d.iso; else break }
    if (!iso) continue
    const strong = clean((inner.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1])
    const badge = clean((inner.match(/<span class="badge[^"]*">([^<]*)<\/span>/) || [])[1])
    const after = inner.split(/<\/span>/)[1] || ''
    const desc = clean((after.match(/^([^<]*)/) || [])[1])
    const lieu = clean((inner.match(/fa-map-marker[^>]*><\/i>([^<]*)/) || [])[1]).replace(/^-\s*/, '')
    const interv = clean((inner.match(/fa-id-badge[^>]*><\/i>([^<]*)/) || [])[1])
    out.push({
      date_debut: iso, heure: debut, fin,
      titre: desc || strong, type: badge || 'Cours',
      lieu, intervenant: interv, formation: strong,
      couleur: feed.couleur, source: feed.nom, lien: feed.url,
    })
  }
  return out
}

async function recupererFeed(feed: Feed): Promise<Ev[]> {
  const hit = cache.get(feed.url)
  if (hit && Date.now() - hit.t < TTL) return hit.evs

  const tous: Ev[] = []
  // GET initial (mois courant) + capture du cookie de session
  let res = await fetch(feed.url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
  if (!res.ok) return []
  let cookie = (res.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ')
  let html = await res.text()
  tous.push(...parseEvenements(html, feed))

  // Postbacks « mois suivant »
  for (let i = 1; i < MOIS_AVANT; i++) {
    const form = new URLSearchParams()
    form.set('__EVENTTARGET', 'ctl00$ContentPlaceHolder1$LinkButtonNextMonth')
    form.set('__EVENTARGUMENT', '')
    form.set('__VIEWSTATE', champCache(html, '__VIEWSTATE'))
    form.set('__VIEWSTATEGENERATOR', champCache(html, '__VIEWSTATEGENERATOR'))
    form.set('__EVENTVALIDATION', champCache(html, '__EVENTVALIDATION'))
    form.set('__SCROLLPOSITIONX', '0')
    form.set('__SCROLLPOSITIONY', '0')
    form.set('ctl00$ContentPlaceHolder1$HiddenFieldDate', champCache(html, 'ctl00$ContentPlaceHolder1$HiddenFieldDate'))
    try {
      res = await fetch(feed.url, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: form.toString(),
        cache: 'no-store',
      })
      if (!res.ok) break
      const nouveauCookie = (res.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ')
      if (nouveauCookie) cookie = nouveauCookie
      html = await res.text()
      tous.push(...parseEvenements(html, feed))
    } catch {
      break
    }
  }

  cache.set(feed.url, { t: Date.now(), evs: tous })
  return tous
}

export async function POST(request: NextRequest) {
  let feeds: Feed[] = []
  try {
    const body = await request.json()
    feeds = Array.isArray(body?.feeds) ? body.feeds : []
  } catch {
    return NextResponse.json({ evenements: [] }, { status: 400 })
  }

  const resultats = await Promise.all(feeds.map(f => (f?.url ? recupererFeed(f) : Promise.resolve([]))))
  const evenements = resultats.flat().sort((a, b) =>
    (a.date_debut + a.heure).localeCompare(b.date_debut + b.heure)
  )
  return NextResponse.json({ evenements })
}
