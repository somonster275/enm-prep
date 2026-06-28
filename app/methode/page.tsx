import Link from 'next/link'
import { LogoBadge } from '@/components/Logo'
import MethodeContenu from '@/components/MethodeContenu'

export const metadata = { title: 'Méthode — codex' }

export default function MethodePage() {
  return (
    <div className="bg-grille" style={{ minHeight: '100vh', backgroundColor: '#FDF6EA', fontFamily: "'Hanken Grotesk', sans-serif", color: '#2A2018' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 22px 60px' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: 28 }}><LogoBadge size={20} /></Link>

        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 30, margin: '0 0 18px' }}>Bien réviser : la méthode</h1>

        <MethodeContenu />
      </div>
    </div>
  )
}
