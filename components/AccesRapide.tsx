'use client'
import Link from 'next/link'

// Widget de raccourcis directs : toutes les fonctionnalités + un accès rapide
// par matière (avec le nombre de fiches dues). Pensé pour cohabiter avec
// d'autres widgets dans une rangée modulaire.
type Matiere = { slug: string; nom: string; dues: number }

const display = "var(--font-titre)"

const FONCTIONS: { href: string; label: string; couleur: string }[] = [
  { href: '/espaces', label: 'Fiches', couleur: '#A3122A' },
  { href: '/cours', label: 'Cours', couleur: '#3B82D9' },
  { href: '/qcm', label: 'QCM', couleur: '#E8A11E' },
  { href: '/duel', label: 'Duel', couleur: '#C0392B' },
  { href: '/mind-maps', label: 'Mind maps', couleur: '#2DAE83' },
  { href: '/media', label: 'Vidéos', couleur: '#3B82D9' },
  { href: '/cours-ia', label: 'Coach IA', couleur: '#7C5CBF' },
  { href: '/annales', label: 'Annales', couleur: '#0F6E56' },
  { href: '/forum', label: 'Forum', couleur: '#D96A2D' },
  { href: '/entraide', label: 'Entraide', couleur: '#2DAE83' },
  { href: '/classement', label: 'Classement', couleur: '#E8A11E' },
  { href: '/recherche', label: 'Recherche', couleur: '#8A7E68' },
  { href: '/carnet', label: 'Carnet', couleur: '#A3122A' },
]

export default function AccesRapide({ matieres }: { matieres: Matiere[] }) {
  return (
    <div style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '22px 24px' }}>
      <h2 style={{ fontFamily: display, fontWeight: 600, fontSize: 19, margin: '0 0 12px' }}>Accès rapide</h2>
      <div className="no-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 6 }}>
        {FONCTIONS.map(f => (
          <Link key={f.href} href={f.href} className="raccourci" style={{
            textDecoration: 'none', color: 'var(--c-encre)', fontSize: 14, fontWeight: 500,
            padding: '8px 10px', borderRadius: 4, borderLeft: `2px solid ${f.couleur}`, background: 'var(--c-papier)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{f.label}</Link>
        ))}
      </div>

      {matieres.length > 0 && (
        <>
          <h3 style={{ fontFamily: display, fontWeight: 600, fontSize: 16, margin: '20px 0 10px' }}>Réviser une matière</h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {matieres.map(m => (
              <Link key={m.slug} href={`/espaces/${m.slug}/revision`} className="raccourci" style={{
                textDecoration: 'none', color: 'var(--c-encre)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 4, border: '1px solid var(--c-filet-fort)', fontSize: 14, fontWeight: 500,
              }}>
                {m.nom}
                {m.dues > 0 && <span style={{ background: 'var(--c-surligneur)', color: 'var(--c-encre)', fontSize: 12, fontWeight: 600, borderRadius: 2, padding: '0 5px' }}>{m.dues}</span>}
              </Link>
            ))}
          </div>
        </>
      )}

      <style>{`.raccourci:hover{background:var(--c-papier-teinte)}`}</style>
    </div>
  )
}
