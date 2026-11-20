'use client'
import { useState } from 'react'
import TuteurChat from '@/components/TuteurChat'
import { useIsMobile } from '@/lib/useIsMobile'

export default function ChatbotBulle() {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const coral = '#A3122A'

  return (
    <>
      {/* Panneau de chat */}
      {open && (
        <div style={{
          position: 'fixed', zIndex: 999,
          ...(isMobile
            ? { inset: 8, top: 8 }
            : { bottom: 92, right: 24, width: 380, height: 560, maxHeight: 'calc(100vh - 120px)' }),
          background: 'var(--c-papier-teinte)', border: '1px solid var(--c-filet-fort)', borderRadius: 18,
          boxShadow: '0 24px 60px -20px rgba(40,30,20,.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderBottom: '1px solid var(--c-filet)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 20 }}>📕</span>
              <div>
                <div style={{ fontWeight: 'var(--titre-poids)', fontSize: 14.5, fontFamily: "var(--font-titre)" }}>Coach IA</div>
                <div style={{ fontSize: 11, color: 'var(--c-annotation-clair)' }}>Révisions · planning · méthode</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-annotation-clair)', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <TuteurChat variant="bubble" />
          </div>
        </div>
      )}

      {/* Bouton bulle */}
      <button onClick={() => setOpen(o => !o)} aria-label="Coach IA" style={{
        position: 'fixed', bottom: 22, right: 22, zIndex: 1000,
        width: 60, height: 60, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: coral, color: '#fff', fontSize: 27,
        boxShadow: '0 12px 28px -8px rgba(163,18,42,.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {open ? '×' : '📕'}
      </button>
    </>
  )
}
