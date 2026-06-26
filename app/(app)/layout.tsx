import TopNav from '@/components/TopNav'
import AuthGuard from '@/components/AuthGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ minHeight: '100vh', background: '#FDF6EA' }}>
        <TopNav />
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 36px 60px' }}>
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
