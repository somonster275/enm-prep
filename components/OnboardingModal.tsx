'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MethodeContenu from './MethodeContenu'
import { useEchap } from '@/lib/useEchap'

const FONT = "var(--font-texte)"

// Fenêtre d'accueil affichée UNE SEULE FOIS, à la première arrivée de l'étudiant
// sur son espace. Mémorisée par utilisateur dans ce navigateur (ne revient plus).
export default function OnboardingModal() {
  const [show, setShow] = useState(false)
  const [uid, setUid] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id
      if (!id) return
      setUid(id)
      try {
        if (!localStorage.getItem(`codex-onboarding-vu-${id}`)) setShow(true)
      } catch { /* localStorage indisponible : on n'affiche pas, pas bloquant */ }
    })
  }, [])

  const fermer = () => {
    try { if (uid) localStorage.setItem(`codex-onboarding-vu-${uid}`, '1') } catch {}
    setShow(false)
  }
  useEchap(show, fermer)

  if (!show) return null

  return (
    <div onClick={fermer} style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,20,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Bienvenue" style={{
        background: '#FFFEFB', borderRadius: 6, width: '100%', maxWidth: 620, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', fontFamily: FONT, color: 'var(--c-encre)',
        boxShadow: '0 30px 80px -30px rgba(40,30,20,.6)', overflow: 'hidden',
      }}>
        <div style={{ padding: '22px 26px 14px', borderBottom: '1px solid var(--c-filet)' }}>
          <div style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 24 }}>Bienvenue sur codex</div>
          <div style={{ fontSize: 14, color: 'var(--c-annotation)', marginTop: 4 }}>Prends 1 minute pour réviser… efficacement.</div>
        </div>

        <div style={{ padding: '20px 26px', overflowY: 'auto' }}>
          <MethodeContenu />
        </div>

        <div style={{ padding: '14px 26px', borderTop: '1px solid var(--c-filet)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={fermer} style={{
            height: 40, padding: '0 18px', border: '1px solid var(--c-filet-fort)', borderRadius: 6, background: 'transparent', color: '#A89880',
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          }}>Passer</button>
          <button onClick={fermer} style={{
            height: 46, padding: '0 26px', border: 'none', borderRadius: 6, background: 'var(--c-accent)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
          }}>C&apos;est parti !</button>
        </div>
      </div>
    </div>
  )
}
