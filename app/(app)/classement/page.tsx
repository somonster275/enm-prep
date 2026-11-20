'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Ligne = { rang: number; cartes: number; moi: boolean }
type Data = { semaineDebut: string; participants: number; moi: { rang: number; cartes: number }; classement: Ligne[] }
type Config = { type: 'fiches' | 'libre'; titre: string | null; description: string | null; objectif: number | null; matiere: string | null }

export default function ClassementPage() {
  const [data, setData] = useState<Data | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/classement').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
    supabase.from('defi_config').select('*').eq('id', 1).maybeSingle().then(({ data: c }) => { if (c) setConfig(c as Config) })
  }, [])

  const font = "var(--font-texte)"
  const display = "var(--font-titre)"
  const mes = data?.moi.cartes ?? 0
  const libre = config?.type === 'libre'
  const objectif = config?.objectif || 150
  const pct = Math.min(100, Math.round((mes / objectif) * 100))

  const medaille = (rang: number) => rang === 1 ? '🥇' : rang === 2 ? '🥈' : rang === 3 ? '🥉' : `#${rang}`

  return (
    <div style={{ paddingTop: 34, maxWidth: 680, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
      <h1 style={{ fontFamily: display, fontWeight: 'var(--titre-poids)', fontSize: 28, margin: 0 }}>Défi de la semaine</h1>
      <p style={{ fontSize: 15, color: 'var(--c-annotation)', margin: '8px 0 24px' }}>
        Un classement <b>anonyme</b> entre candidats, basé sur le nombre de fiches révisées cette semaine. La régularité paie !
      </p>

      {/* Défi (piloté par l'admin) */}
      <div style={{ background: '#FFC02E', borderRadius: 6, padding: 26, color: 'var(--c-encre)', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: '#FFCE54', right: -40, top: -50 }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: '#7A5E14' }}>
            {config?.titre || (libre ? 'Défi de la semaine' : 'Ton défi')}
            {config?.matiere && <span> · {config.matiere}</span>}
          </div>

          {libre ? (
            <div style={{ fontSize: 16, lineHeight: 1.55, marginTop: 10, color: '#3A2E0E', fontWeight: 600, whiteSpace: 'pre-wrap', maxWidth: 460 }}>
              {config?.description || 'Un défi spécial cette semaine — à toi de jouer !'}
            </div>
          ) : (
            <>
              <div style={{ fontFamily: display, fontWeight: 'var(--titre-poids)', fontSize: 26, marginTop: 8 }}>
                {mes} <span style={{ fontSize: 18, color: '#5C4A22' }}>/ {objectif} cartes</span>
              </div>
              <div style={{ height: 10, background: 'rgba(0,0,0,.12)', borderRadius: 999, overflow: 'hidden', marginTop: 14, maxWidth: 360 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--c-accent)', borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: 13, color: '#5C4A22', marginTop: 10, fontWeight: 600 }}>
                {pct >= 100 ? '🎉 Défi accompli, bravo !' : `Plus que ${Math.max(0, objectif - mes)} cartes pour relever le défi.`}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Classement anonyme */}
      <div style={{ fontFamily: display, fontWeight: 'var(--titre-poids)', fontSize: 18, marginBottom: 12 }}>
        Classement de la semaine {data && <span style={{ fontSize: 13, color: 'var(--c-annotation-clair)', fontWeight: 400, fontFamily: font }}>· {data.participants} participant{data.participants > 1 ? 's' : ''}</span>}
      </div>

      {loading ? (
        <div style={{ color: 'var(--c-annotation-clair)', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : !data || data.classement.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-annotation-clair)', background: 'var(--c-papier)', border: '1px dashed var(--c-filet-fort)', borderRadius: 6 }}>
          Personne n&apos;a encore révisé cette semaine. Sois le premier !
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.classement.map(l => (
            <div key={l.rang} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 6,
              background: l.moi ? 'var(--c-accent-pale)' : '#fff', border: `1px solid ${l.moi ? 'var(--c-accent-bord)' : 'var(--c-filet)'}`,
            }}>
              <span style={{ fontSize: 16, fontWeight: 800, width: 34, textAlign: 'center', color: l.rang <= 3 ? 'var(--c-encre)' : 'var(--c-annotation-clair)' }}>{medaille(l.rang)}</span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: l.moi ? 700 : 600, color: l.moi ? '#C0392B' : '#3A3226' }}>
                {l.moi ? 'Toi' : 'Étudiant anonyme'}
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{l.cartes} <span style={{ color: 'var(--c-annotation-clair)', fontWeight: 400, fontSize: 13 }}>cartes</span></span>
            </div>
          ))}
          {data.moi.rang > 15 && data.moi.rang > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 6, background: 'var(--c-accent-pale)', border: '1px solid var(--c-accent-bord)', marginTop: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, width: 34, textAlign: 'center', color: 'var(--c-annotation-clair)' }}>#{data.moi.rang}</span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: '#C0392B' }}>Toi</span>
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{data.moi.cartes} <span style={{ color: 'var(--c-annotation-clair)', fontWeight: 400, fontSize: 13 }}>cartes</span></span>
            </div>
          )}
          {data.moi.rang === 0 && (
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--c-annotation-clair)', padding: '12px 0' }}>
              Tu n&apos;as pas encore révisé cette semaine — commence une session pour apparaître ici !
            </div>
          )}
        </div>
      )}
    </div>
  )
}
