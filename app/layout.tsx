import type { Metadata } from 'next'
import './fonts.css'
import './globals.css'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'codex',
  description: 'codex — préparation au concours ENM',
  appleWebApp: { capable: true, title: 'codex', statusBarStyle: 'default' }, // plein écran une fois ajouté à l'écran d'accueil iOS
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#F7F5F1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "var(--font-texte)" }}>
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
