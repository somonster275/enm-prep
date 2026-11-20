'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const FONT = "var(--font-texte)"

type Lien = { titre: string; href: string; label: string }

// Affiche les ressources (vidéo, audio, cours, QCM, mind map) qui partagent un
// tag avec la fiche en cours — pour varier les supports de révision. Chaque lien
// s'ouvre dans un nouvel onglet. N'affiche rien s'il n'y a aucune ressource liée.
export default function Approfondir({ tags }: { tags: string[] }) {
  const [liens, setLiens] = useState<Lien[]>([])
  const [ouvert, setOuvert] = useState(false)
  const cle = (tags || []).join(',')

  useEffect(() => {
    const t = (cle ? cle.split(',') : []).filter(Boolean)
    if (t.length === 0) { setLiens([]); return }
    let annule = false
    const charger = async () => {
      const [med, mind, cours, qcm] = await Promise.all([
        supabase.from('medias').select('id, titre, url, type').overlaps('tags', t).is('deleted_at', null).limit(12),
        supabase.from('mindmaps').select('id, titre, url').overlaps('tags', t).is('deleted_at', null).limit(12),
        supabase.from('cours').select('id, titre, type').overlaps('tags', t).limit(12),
        supabase.from('qcm').select('id, titre').overlaps('tags', t).limit(12),
      ])
      const out: Lien[] = []
      for (const m of (med.data || []) as { id: string; titre: string; url: string | null; type: string | null }[]) {
        const audio = m.type === 'audio'
        out.push({ titre: m.titre, href: m.url || '/media', label: audio ? 'Audio' : 'Vidéo' })
      }
      for (const m of (mind.data || []) as { id: string; titre: string; url: string | null }[])
        out.push({ titre: m.titre, href: m.url || '/mind-maps', label: 'Mind map' })
      for (const c of (cours.data || []) as { id: string; titre: string; type: string | null }[])
        out.push({ titre: c.titre, href: `/cours?c=${c.id}`, label: 'Cours' })
      for (const q of (qcm.data || []) as { id: string; titre: string }[])
        out.push({ titre: q.titre, href: `/qcm?id=${q.id}`, label: 'QCM' })
      if (!annule) setLiens(out)
    }
    charger()
    return () => { annule = true }
  }, [cle])

  if (liens.length === 0) return null

  return (
    <div style={{ marginTop: 14, border: '1px solid #E4D8F0', borderRadius: 6, overflow: 'hidden', fontFamily: FONT }}>
      <button onClick={() => setOuvert(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: '#F6F1FD', border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
      }}>
        <span style={{ flex: 1, fontWeight: 800, fontSize: 14.5, color: '#5B3FA6' }}>
          Approfondir <span style={{ fontWeight: 600, color: '#8A7CB0' }}>· {liens.length} ressource{liens.length > 1 ? 's' : ''} liée{liens.length > 1 ? 's' : ''}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C5CBF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: ouvert ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {ouvert && (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, background: '#FFFEFB' }}>
          {liens.map((l, i) => (
            <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6,
              border: '1px solid var(--c-filet)', background: 'var(--c-papier)', textDecoration: 'none', color: 'var(--c-encre)',
            }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{l.titre}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-annotation-clair)', flexShrink: 0 }}>{l.label} ↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
