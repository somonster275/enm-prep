'use client'
import type { DetailProgression } from '@/lib/progression'

export default function ProgressionCard({ detail }: { detail: DetailProgression }) {
  const font = "var(--font-texte)"

  const dims: { label: string; valeur: number; couleur: string }[] = [
    { label: 'Maîtrise', valeur: detail.maitrise, couleur: '#0F6E56' },
    { label: 'Couverture', valeur: detail.couverture, couleur: '#185FA5' },
    { label: 'Régularité', valeur: detail.regularite, couleur: '#A3122A' },
  ]

  return (
    <div style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '16px 24px', fontFamily: font, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      {/* Score global compact */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
          background: `conic-gradient(var(--c-accent) ${detail.global * 3.6}deg, var(--c-filet) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#FFFEFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--c-encre)' }}>{detail.global}%</div>
        </div>
        <div style={{ fontFamily: 'var(--font-titre)', fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>Ta progression</div>
      </div>

      {/* Détail des 3 dimensions */}
      <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {dims.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--c-texte-doux)', width: 84, flexShrink: 0 }}>{d.label}</span>
            <div style={{ flex: 1, height: 4, background: 'var(--c-filet)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${d.valeur}%`, height: '100%', background: d.couleur }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-encre)', width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.valeur}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
