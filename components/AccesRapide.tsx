'use client'
import Link from 'next/link'

// Widget de raccourcis directs : toutes les fonctionnalités + un accès rapide
// par matière (avec le nombre de fiches dues). Pensé pour cohabiter avec
// d'autres widgets dans une rangée modulaire.
type Matiere = { slug: string; nom: string; dues: number }

const display = "'Bricolage Grotesque', sans-serif"

const FONCTIONS: { href: string; icone: string; label: string; couleur: string }[] = [
  { href: '/espaces', icone: '🗂️', label: 'Fiches', couleur: '#DC4A2B' },
  { href: '/qcm', icone: '✅', label: 'QCM', couleur: '#E8A11E' },
  { href: '/duel', icone: '⚔️', label: 'Duel', couleur: '#C0392B' },
  { href: '/mind-maps', icone: '🧠', label: 'Mind maps', couleur: '#2DAE83' },
  { href: '/media', icone: '🎬', label: 'Vidéos', couleur: '#3B82D9' },
  { href: '/cours-ia', icone: '🤖', label: 'Coach IA', couleur: '#7C5CBF' },
  { href: '/annales', icone: '📚', label: 'Annales', couleur: '#0F6E56' },
  { href: '/forum', icone: '💬', label: 'Forum', couleur: '#D96A2D' },
  { href: '/entraide', icone: '🤝', label: 'Entraide', couleur: '#2DAE83' },
  { href: '/classement', icone: '🏆', label: 'Classement', couleur: '#E8A11E' },
  { href: '/recherche', icone: '🔍', label: 'Recherche', couleur: '#8A7E68' },
  { href: '/carnet', icone: '📕', label: 'Carnet', couleur: '#DC4A2B' },
]

export default function AccesRapide({ matieres }: { matieres: Matiere[] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: 22 }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Accès rapide</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 10 }}>
        {FONCTIONS.map(f => (
          <Link key={f.href} href={f.href} className="raccourci" style={{
            textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
            padding: '13px 6px', borderRadius: 13, border: '1px solid #F0E7D6', background: '#FFFDF9',
          }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: f.couleur + '1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{f.icone}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#5C5345', textAlign: 'center' }}>{f.label}</span>
          </Link>
        ))}
      </div>

      {matieres.length > 0 && (
        <>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 13.5, margin: '20px 0 10px', color: '#8A7E68' }}>Réviser une matière</div>
          <div className="matieres-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {matieres.map(m => (
              <Link key={m.slug} href={`/espaces/${m.slug}/revision`} className="raccourci" style={{
                textDecoration: 'none', color: 'inherit', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 999, border: '1px solid #F0E7D6', background: '#FFFDF9', fontSize: 13, fontWeight: 600,
              }}>
                {m.nom}
                {m.dues > 0 && <span style={{ background: '#DC4A2B', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '1px 7px' }}>{m.dues}</span>}
              </Link>
            ))}
          </div>
        </>
      )}

      <style>{`
        .raccourci{transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease}
        .raccourci:hover{transform:translateY(-3px); box-shadow:0 6px 16px -8px rgba(40,30,60,.25); border-color:#E4D8C2}
        .matieres-scroll::-webkit-scrollbar{height:6px}
        .matieres-scroll::-webkit-scrollbar-track{background:transparent}
        .matieres-scroll::-webkit-scrollbar-thumb{background:#E4D8C2; border-radius:999px}
      `}</style>
    </div>
  )
}
