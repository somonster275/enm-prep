import TopNav from '@/components/TopNav'
import AuthGuard from '@/components/AuthGuard'
import ChatbotBulle from '@/components/ChatbotBulle'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="bg-grille" style={{ minHeight: '100vh', backgroundColor: '#FDF6EA' }}>
        <TopNav />
        <main className="app-main" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 36px 60px' }}>
          {children}
        </main>
        <ChatbotBulle />
      </div>
    </AuthGuard>
  )
}
