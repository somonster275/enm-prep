import type { MetadataRoute } from 'next'

// Rend codex installable (ordinateur et téléphone). Doit rester public : voir le matcher de proxy.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'codex — préparation ENM',
    short_name: 'codex',
    description: 'Préparation au concours de l\'ENM',
    lang: 'fr',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F7F5F1',
    theme_color: '#F7F5F1',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
