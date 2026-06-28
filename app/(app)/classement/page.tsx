'use client'
import { useEffect, useState } from 'react'

type Ligne = { rang: number; cartes: number; moi: boolean }
type Data = { semaineDebut: string; participants: number; moi: { rang: number; cartes: number }; classement: Ligne[] }

const DEFI_HEBDO = 150 // objectif de cartes pour le défi de la semaine

export default function ClassementPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/classement').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"
  const mes = data?.moi.cartes ?? 0
  const pct = Math.min(100, Math.round((mes / DEFI_HEBDO) * 100))

  const medaille = (rang: number) => rang === 1 ? '🥇' : rang === 2 ? '🥈' : rang === 3 ? '🥉' : `#${rang}`

  return (
    <div style={{ paddingTop: 34, maxWidth: 680, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: 28, margin: 0 }}>Défi de la semaine</h1>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 24px' }}>
        Un classement <b>anonyme</b> entre candidats, basé sur le nombre de fiches révisées cette semaine. La régularité paie !
      </p>

      {/* Défi personnel */}
      <div style={{ background: '#FFC02E', borderRadius: 20, padding: 26, color: '#2A2018', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: '#FFCE54', right: -40, top: -50 }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7A5E14' }}>Ton défi</div>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 26, marginTop: 8 }}>
            {mes} <span style={{ fontSize: 18, color: '#5C4A22' }}>/ {DEFI_HEBDO} cartes</span>
          </div>
          <div style={{ height: 10, background: 'rgba(0,0,0,.12)', borderRadius: 999, overflow: 'hidden', marginTop: 14, maxWidth: 360 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#DC4A2B', borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 13, color: '#5C4A22', marginTop: 10, fontWeight: 600 }}>
            {pct >= 100 ? '🎉 Défi accompli, bravo !' : `Plus que ${DEFI_HEBDO - mes} cartes pour relever le défi.`}
          </div>
        </div>
      </div>

      {/* Classement anonyme */}
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
        Classement de la semaine {data && <span style={{ fontSize: 13, color: '#9A8D72', fontWeight: 400, fontFamily: font }}>· {data.participants} participant{data.participants > 1 ? 's' : ''}</span>}
      </div>

      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : !data || data.classement.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>
          Personne n&apos;a encore révisé cette semaine. Sois le premier !
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.classement.map(l => (
            <div key={l.rang} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12,
              background: l.moi ? '#FCE9E3' : '#fff', border: `1px solid ${l.moi ? '#F3C6BC' : '#F0E7D6'}`,
            }}>
              <span style={{ fontSize: 16, fontWeight: 800, width: 34, textAlign: 'center', color: l.rang <= 3 ? '#2A2018' : '#9A8D72' }}>{medaille(l.rang)}</span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: l.moi ? 700 : 600, color: l.moi ? '#C0392B' : '#3A3226' }}>
                {l.moi ? 'Toi' : 'Étudiant anonyme'}
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{l.cartes} <span style={{ color: '#9A8D72', fontWeight: 400, fontSize: 13 }}>cartes</span></span>
            </div>
          ))}
          {data.moi.rang > 15 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, background: '#FCE9E3', border: '1px solid #F3C6BC', marginTop: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, width: 34, textAlign: 'center', color: '#9A8D72' }}>#{data.moi.rang}</span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: '#C0392B' }}>Toi</span>
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{data.moi.cartes} <span style={{ color: '#9A8D72', fontWeight: 400, fontSize: 13 }}>cartes</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
