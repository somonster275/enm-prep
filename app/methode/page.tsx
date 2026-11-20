import Link from 'next/link'
import { LogoBadge } from '@/components/Logo'
import MethodeContenu from '@/components/MethodeContenu'

export const metadata = { title: 'Méthode — codex' }

export default function MethodePage() {
  return (
    <div className="bg-grille" style={{ minHeight: '100vh', backgroundColor: 'var(--c-papier-teinte)', fontFamily: "var(--font-texte)", color: 'var(--c-encre)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 22px 60px' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: 28 }}><LogoBadge size={20} /></Link>

        <h1 style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 30, margin: '0 0 18px' }}>Bien réviser : la méthode</h1>

        <MethodeContenu />
      </div>
    </div>
  )
}
