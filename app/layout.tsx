import type { Metadata } from 'next'
import './fonts.css'
import './globals.css'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'codex',
  description: 'codex — préparation au concours ENM',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "'Hanken Grotesk', sans-serif" }}>
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
