'use client'
import TuteurChat from '@/components/TuteurChat'

export default function TuteurPage() {
  return (
    <div style={{ paddingTop: 28, height: 'calc(100vh - 64px - 60px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 24 }}>Coach IA</div>
        <div style={{ fontSize: 13.5, color: '#8A7E68' }}>Révisions, planning et méthode — il connaît le programme ENM et le temps qu&apos;il te reste.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <TuteurChat variant="full" />
      </div>
    </div>
  )
}
