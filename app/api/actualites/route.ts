import { NextResponse, type NextRequest } from 'next/server'

// Récupère et parse des flux RSS / Atom côté serveur (contourne le CORS du navigateur).
// Entrée  : { feeds: [{ url, nom, couleur }] }
// Sortie  : { articles: [{ titre, lien, date, extrait, image, source, couleur }] }

type FeedEntree = { url: string; nom: string; couleur: string }

type Article = {
  titre: string
  lien: string
  date: string | null      // ISO ou null
  extrait: string
  image: string | null
  source: string
  couleur: string
}

const decoderEntites = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&')

const stripHtml = (s: string) =>
  decoderEntites(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

const champ = (bloc: string, balise: string): string | null => {
  // <balise ...>contenu</balise>  (premier match)
  const re = new RegExp(`<${balise}(?:\\s[^>]*)?>([\\s\\S]*?)</${balise}>`, 'i')
  const m = bloc.match(re)
  return m ? m[1].trim() : null
}

const lienAtom = (bloc: string): string | null => {
  // Atom : <link href="..." rel="alternate"/>  ou simple <link href="...">
  const alt = bloc.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
                || bloc.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i)
  if (alt) return alt[1]
  const simple = bloc.match(/<link[^>]*href=["']([^"']+)["']/i)
  return simple ? simple[1] : null
}

const imageDe = (bloc: string): string | null => {
  const enclosure = bloc.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)
  if (enclosure) return enclosure[1]
  const mediaContent = bloc.match(/<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/i)
  if (mediaContent) return mediaContent[1]
  const dansContenu = bloc.match(/<img[^>]*src=["']([^"']+)["']/i)
  if (dansContenu) return dansContenu[1]
  return null
}

const dateIso = (s: string | null): string | null => {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parserFlux(xml: string, feed: FeedEntree): Article[] {
  const articles: Article[] = []

  // RSS : <item>…</item>  /  Atom : <entry>…</entry>
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml)
  const baliseItem = isAtom ? 'entry' : 'item'
  const re = new RegExp(`<${baliseItem}(?:\\s[^>]*)?>([\\s\\S]*?)</${baliseItem}>`, 'gi')

  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const bloc = m[1]
    const titre = champ(bloc, 'title')
    if (!titre) continue
    const lien = isAtom ? lienAtom(bloc) : (champ(bloc, 'link') || lienAtom(bloc))
    const rawDate = champ(bloc, 'pubDate') || champ(bloc, 'published') || champ(bloc, 'updated') || champ(bloc, 'dc:date')
    const desc = champ(bloc, 'description') || champ(bloc, 'summary') || champ(bloc, 'content') || ''
    const image = imageDe(bloc) || imageDe(desc)
    let extrait = stripHtml(desc)
    if (extrait.length > 180) extrait = extrait.slice(0, 177) + '…'

    articles.push({
      titre: decoderEntites(stripHtml(titre)),
      lien: lien ? decoderEntites(lien.trim()) : '#',
      date: dateIso(rawDate),
      extrait,
      image,
      source: feed.nom,
      couleur: feed.couleur,
    })
  }
  return articles.slice(0, 12)
}

export async function POST(request: NextRequest) {
  let feeds: FeedEntree[] = []
  try {
    const body = await request.json()
    feeds = Array.isArray(body?.feeds) ? body.feeds : []
  } catch {
    return NextResponse.json({ articles: [], erreurs: ['Requête invalide'] }, { status: 400 })
  }

  const erreurs: string[] = []
  const resultats = await Promise.all(
    feeds.map(async (feed): Promise<Article[]> => {
      if (!feed?.url) return []
      try {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CodexActu/1.0)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
          next: { revalidate: 600 }, // 10 min de cache serveur
        })
        if (!res.ok) { erreurs.push(`${feed.nom} : HTTP ${res.status}`); return [] }
        const xml = await res.text()
        return parserFlux(xml, feed)
      } catch {
        erreurs.push(`${feed.nom} : flux inaccessible`)
        return []
      }
    })
  )

  const articles = resultats
    .flat()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return NextResponse.json({ articles, erreurs })
}
