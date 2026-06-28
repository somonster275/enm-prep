import Link from 'next/link'

// Mini pied de page présent sur toutes les pages (rendu dans le layout racine).
export default function SiteFooter() {
  const lien: React.CSSProperties = {
    color: '#8A7E68', textDecoration: 'none', fontWeight: 600, fontSize: 13,
    padding: '4px 8px', borderRadius: 8,
  }
  return (
    <footer style={{
      borderTop: '1px solid #F0E7D6', background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '14px 20px', fontFamily: "'Hanken Grotesk', sans-serif",
    }}>
      <Link href="/contact" style={lien}>Nous contacter</Link>
      <span style={{ color: '#E0D6C2' }}>·</span>
      <Link href="/methode" style={lien}>Méthode</Link>
      <span style={{ color: '#E0D6C2' }}>·</span>
      <Link href="/donnees" style={lien}>Données</Link>
    </footer>
  )
}
