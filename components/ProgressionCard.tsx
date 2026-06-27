'use client'
import type { DetailProgression } from '@/lib/progression'

export default function ProgressionCard({ detail }: { detail: DetailProgression }) {
  const font = "'Hanken Grotesk', sans-serif"

  const dims: { label: string; valeur: number; couleur: string }[] = [
    { label: 'Maîtrise', valeur: detail.maitrise, couleur: '#0F6E56' },
    { label: 'Couverture', valeur: detail.couverture, couleur: '#185FA5' },
    { label: 'Régularité', valeur: detail.regularite, couleur: '#DC4A2B' },
  ]

  return (
    <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 14, padding: '14px 18px', fontFamily: font, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      {/* Score global compact */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
          background: `conic-gradient(#DC4A2B ${detail.global * 3.6}deg, #F1E4CE 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#2A2018' }}>{detail.global}%</div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#8A7E68', lineHeight: 1.3 }}>Ta<br />progression</div>
      </div>

      {/* Détail des 3 dimensions */}
      <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {dims.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#6E6456', width: 78, flexShrink: 0 }}>{d.label}</span>
            <div style={{ flex: 1, height: 6, background: '#F1E4CE', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${d.valeur}%`, height: '100%', background: d.couleur, borderRadius: 999 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: d.couleur, width: 34, textAlign: 'right' }}>{d.valeur}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
