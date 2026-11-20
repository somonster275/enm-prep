'use client'
import { useState } from 'react'
import TuteurChat from '@/components/TuteurChat'
import { useIsMobile } from '@/lib/useIsMobile'

export default function ChatbotBulle() {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  return (
    <>
      {/* Panneau de chat */}
      {open && (
        <div style={{
          position: 'fixed', zIndex: 999,
          ...(isMobile
            ? { inset: 8, top: 8 }
            : { bottom: 92, right: 24, width: 380, height: 560, maxHeight: 'calc(100vh - 120px)' }),
          background: 'var(--c-papier)', border: '1px solid var(--c-filet-fort)', borderRadius: 6,
          boxShadow: '0 24px 60px -20px rgba(40,30,20,.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FFFEFB', borderBottom: '1px solid var(--c-filet)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 18, fontFamily: "var(--font-titre)" }}>Coach IA</div>
                <div style={{ fontSize: 12.5, color: 'var(--c-annotation)' }}>Révisions, planning et méthode</div>
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
        height: 46, padding: open ? '0 16px' : '0 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
        background: 'var(--c-encre)', color: 'var(--c-papier)', fontSize: open ? 22 : 14.5, fontWeight: 600, fontFamily: 'var(--font-texte)',
        boxShadow: '0 10px 24px -10px rgba(33,28,25,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {open ? '×' : 'Coach IA'}
      </button>
    </>
  )
}
