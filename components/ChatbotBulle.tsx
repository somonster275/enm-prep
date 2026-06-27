'use client'
import { useState } from 'react'
import TuteurChat from '@/components/TuteurChat'
import { useIsMobile } from '@/lib/useIsMobile'

export default function ChatbotBulle() {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const coral = '#DC4A2B'

  return (
    <>
      {/* Panneau de chat */}
      {open && (
        <div style={{
          position: 'fixed', zIndex: 999,
          ...(isMobile
            ? { inset: 8, top: 8 }
            : { bottom: 92, right: 24, width: 380, height: 560, maxHeight: 'calc(100vh - 120px)' }),
          background: '#FDF6EA', border: '1px solid #EADFC9', borderRadius: 18,
          boxShadow: '0 24px 60px -20px rgba(40,30,20,.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderBottom: '1px solid #F0E7D6', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 20 }}>🧑‍🏫</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Coach IA</div>
                <div style={{ fontSize: 11, color: '#9A8D72' }}>Révisions · planning · méthode</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A8D72', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
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
        boxShadow: '0 12px 28px -8px rgba(220,74,43,.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {open ? '×' : '🧑‍🏫'}
      </button>
    </>
  )
}
