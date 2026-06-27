'use client'
import type { DetailProgression } from '@/lib/progression'

export default function ProgressionCard({ detail }: { detail: DetailProgression }) {
  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"

  const dims: { label: string; valeur: number; couleur: string; aide: string }[] = [
    { label: 'Maîtrise', valeur: detail.maitrise, couleur: '#0F6E56', aide: 'mémorisation des fiches' },
    { label: 'Couverture', valeur: detail.couverture, couleur: '#185FA5', aide: 'du programme entamé' },
    { label: 'Régularité', valeur: detail.regularite, couleur: '#DC4A2B', aide: 'assiduité sur 7 jours' },
  ]

  return (
    <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: 22, fontFamily: font }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#8A7E68' }}>Ta progression globale</div>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 38, lineHeight: 1.1, color: '#2A2018' }}>
            {detail.global}<span style={{ fontSize: 20, color: '#9A8D72' }}>%</span>
          </div>
        </div>
        {/* Anneau visuel */}
        <div style={{ marginLeft: 'auto', width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          background: `conic-gradient(#DC4A2B ${detail.global * 3.6}deg, #F1E4CE 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#2A2018' }}>{detail.global}%</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {dims.map(d => (
          <div key={d.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2A2018' }}>{d.label} <span style={{ fontSize: 11, color: '#9A8D72', fontWeight: 400 }}>· {d.aide}</span></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: d.couleur }}>{d.valeur}%</span>
            </div>
            <div style={{ height: 7, background: '#F1E4CE', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${d.valeur}%`, height: '100%', background: d.couleur, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
