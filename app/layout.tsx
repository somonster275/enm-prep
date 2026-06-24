import Sidebar from '@/components/Sidebar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8' }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
        </div>
      </body>
    </html>
  )
}