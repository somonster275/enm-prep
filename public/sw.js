// Service worker codex : rend « Mon espace » utilisable sans réseau.
// Noms de caches partagés avec lib/hors-ligne.ts (qui y range les pages et fichiers à garder).
const PAGES = 'codex-pages-v1'
const STATIQUE = 'codex-statique-v1'
const FICHIERS = 'codex-fichiers-v1'

// Seuls les fichiers de notre stockage Supabase (déposés par le staff) sont servis hors ligne.
// Même règle que estFichierStockage() dans lib/hors-ligne.ts.
const estFichierStockage = u => {
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname.endsWith('.supabase.co') && x.pathname.startsWith('/storage/v1/object/public/') }
  catch { return false }
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

const pageHorsLigne = () => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors connexion — codex</title></head>
<body style="font-family:system-ui,sans-serif;background:#F7F5F1;color:#211C19;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><h1 style="font-size:24px;margin:0 0 10px">Hors connexion</h1>
<p style="color:#6b625c;margin:0 0 20px">Cette page a besoin d'internet. Tes copies de « Mon espace » restent disponibles.</p>
<a href="/mon-espace" style="background:#A3122A;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600">Mon espace</a></div>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Fichier téléchargé pour le hors ligne (cours PDF, mind map).
  if (url.pathname === '/fichier-hors-ligne') {
    // Cache uniquement, jamais le réseau : sinon n'importe quel site pourrait être servi sous codexprepa.com.
    const u = url.searchParams.get('u') || ''
    e.respondWith((estFichierStockage(u) ? caches.open(FICHIERS).then(c => c.match(u)) : Promise.resolve(undefined))
      .then(r => r || new Response('Fichier non disponible hors ligne.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })))
    return
  }

  // JavaScript, CSS, polices : noms versionnés, donc cache d'abord.
  // shortcut: ce cache grossit à chaque déploiement, à purger par version si son poids devient gênant.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.open(STATIQUE).then(async c => (await c.match(req)) || fetch(req).then(r => {
      if (r.ok) c.put(req, r.clone())
      return r
    })))
    return
  }

  // Pages : réseau d'abord ; une page déjà gardée pour le hors ligne est rafraîchie au passage.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const pages = await caches.open(PAGES)
      try {
        const r = await fetch(req)
        if (r.ok && !r.redirected && await pages.match(req.url)) pages.put(req.url, r.clone())
        return r
      } catch {
        const page = await pages.match(req.url)
        if (page) return page
        // Ex. l'app installée qui s'ouvre sur le tableau de bord dans le train : on va droit à « Mon espace ».
        if (url.pathname !== '/mon-espace' && await pages.match('/mon-espace')) return Response.redirect(new URL('/mon-espace', self.location.origin).href, 302)
        return pageHorsLigne()
      }
    })())
  }
})
