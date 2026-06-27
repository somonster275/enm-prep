import Link from 'next/link'
import { LogoBadge } from '@/components/Logo'

export const metadata = { title: 'Données — codex' }

const points: { titre: string; texte: string }[] = [
  {
    titre: 'Tes données t\'appartiennent',
    texte: "Ta progression, tes fiches, tes notes et tes liens ne sont visibles que par toi. Chaque compte est cloisonné : aucun autre étudiant ne peut accéder à tes informations.",
  },
  {
    titre: 'Cloisonnement technique',
    texte: "L'accès aux données est protégé au niveau de la base par des règles de sécurité par utilisateur (Row Level Security). Concrètement, la base elle-même refuse de renvoyer les données d'un autre compte que le tien.",
  },
  {
    titre: 'Aucune revente, aucun partage',
    texte: "Tes données ne sont ni vendues, ni transmises à des tiers à des fins commerciales ou publicitaires. Elles servent uniquement à faire fonctionner ton espace de révision.",
  },
  {
    titre: 'Drive et fichiers',
    texte: "Si tu connectes un espace de stockage (Google Drive…), codex n'accède qu'en lecture à ce que tu autorises, pour te le présenter dans l'app. Tes fichiers restent chez ton fournisseur ; ils ne sont pas recopiés ni stockés par codex. Tu peux déconnecter ton compte à tout moment.",
  },
  {
    titre: 'Suppression',
    texte: "Tu peux demander la suppression de ton compte et de tes données à tout moment via la page « Nous contacter ».",
  },
]

export default function DonneesPage() {
  return (
    <div className="bg-grille" style={{ minHeight: '100vh', backgroundColor: '#FDF6EA', fontFamily: "'Hanken Grotesk', sans-serif", color: '#2A2018' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 22px 60px' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: 28 }}><LogoBadge size={20} /></Link>

        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 30, margin: 0 }}>Tes données</h1>
        <p style={{ fontSize: 15.5, color: '#8A7E68', margin: '10px 0 28px' }}>
          La confidentialité de tes informations est une priorité. Voici, en clair, comment elles sont traitées.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {points.map(p => (
            <div key={p.titre} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: '#ECF7F0', color: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>✓</span>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{p.titre}</div>
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.6, color: '#5C5448' }}>{p.texte}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22, fontSize: 14, color: '#8A7E68' }}>
          Une question sur tes données ? <Link href="/contact" style={{ color: '#DC4A2B', fontWeight: 700, textDecoration: 'none' }}>Contacte-nous</Link>.
        </div>
      </div>
    </div>
  )
}
