'use client'
import { useEffect, useState } from 'react'

// Widget unique qui « circule » entre plusieurs statistiques (série, objectif,
// semaine…) : défilement automatique, transition animée, points cliquables,
// pause au survol. Conçu pour vivre dans une rangée de widgets modulaires.
export type StatItem = {
  cle: string
  icone: string
  iconeBg: string
  label: string
  valeur: React.ReactNode
  barPct?: number
}

const display = "'Bricolage Grotesque', sans-serif"

export default function StatRotatif({ items, intervalle = 4500 }: { items: StatItem[]; intervalle?: number }) {
  const [i, setI] = useState(0)
  const [pause, setPause] = useState(false)

  useEffect(() => {
    if (pause || items.length <= 1) return
    const t = setInterval(() => setI(v => (v + 1) % items.length), intervalle)
    return () => clearInterval(t)
  }, [pause, items.length, intervalle])

  if (items.length === 0) return null
  const it = items[Math.min(i, items.length - 1)]

  return (
    <div
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: 22, minHeight: 152, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}
    >
      <div key={it.cle} style={{ animation: 'statIn .45s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: it.iconeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{it.icone}</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#8A7E68' }}>{it.label}</span>
        </div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, marginTop: 14 }}>{it.valeur}</div>
        {typeof it.barPct === 'number' && (
          <div style={{ height: 6, background: '#F1E4CE', borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ width: `${it.barPct}%`, height: '100%', background: '#DC4A2B', borderRadius: 999, transition: 'width .6s ease' }} />
          </div>
        )}
      </div>

      {/* Points de navigation entre les statistiques */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
        {items.map((s, idx) => (
          <button key={s.cle} onClick={() => setI(idx)} aria-label={s.label} style={{
            width: idx === i ? 18 : 7, height: 7, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0,
            background: idx === i ? '#DC4A2B' : '#E4D8C2', transition: 'all .3s ease',
          }} />
        ))}
      </div>

      <style>{`@keyframes statIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
