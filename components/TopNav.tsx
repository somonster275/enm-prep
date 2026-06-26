'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { Profil } from '@/types'
import { chargerActivite, calculerStreak } from '@/lib/streaks'
import { LogoBadge } from '@/components/Logo'

export default function TopNav() {
  const pathname = usePathname()
  const [profil, setProfil] = useState<Profil | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      let { data: prof } = await supabase.from('profils').select('*').eq('id', user.id).single()
      if (!prof) {
        const { data: newProf } = await supabase.from('profils').insert({
          id: user.id, email: user.email, role: 'etudiant'
        }).select().single()
        prof = newProf
      }
      setProfil(prof)
      const activite = await chargerActivite(user.id)
      setStreak(calculerStreak(activite))
    }
    load()
  }, [pathname])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initiales = profil?.email ? profil.email.slice(0, 2).toUpperCase() : '?'
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const navLink = (href: string, label: string) => (
    <Link href={href} style={{
      fontSize: 14, fontWeight: isActive(href) ? 700 : 600,
      color: isActive(href) ? '#2A2018' : '#8A7E68',
      background: isActive(href) ? '#FCEFD3' : 'transparent',
      padding: '9px 16px', borderRadius: 10,
      textDecoration: 'none',
      transition: 'background 0.1s',
    }}>
      {label}
    </Link>
  )

  return (
    <div style={{
      background: '#fff',
      borderBottom: '1px solid #F0E7D6',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: '0 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <LogoBadge size={18} />
          </Link>
          <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {navLink('/dashboard', 'Accueil')}
            {navLink('/espaces', 'Espaces')}
            {navLink('/actualites', 'Actualités')}
            {navLink('/cours-ia', 'Questions de cours')}
            {profil?.role === 'admin' && navLink('/calendrier', 'Calendrier')}

            {/* Dropdown Admin */}
            {(profil?.role === 'admin' || profil?.role === 'editeur') && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setAdminOpen(o => !o)}
                  style={{
                    fontSize: 14, fontWeight: 600,
                    color: ['/admin/editeur','/admin/import','/admin/corbeille','/admin/utilisateurs'].some(p => pathname.startsWith(p)) ? '#2A2018' : '#8A7E68',
                    background: ['/admin/editeur','/admin/import','/admin/corbeille','/admin/utilisateurs'].some(p => pathname.startsWith(p)) ? '#FCEFD3' : 'transparent',
                    padding: '9px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  Admin
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {adminOpen && (
                  <>
                    <div onClick={() => setAdminOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                    <div style={{
                      position: 'absolute', top: 44, left: 0, minWidth: 180, zIndex: 200,
                      background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12,
                      boxShadow: '0 8px 24px -8px rgba(40,30,60,.18)', padding: 6,
                    }}>
                      {[
                        { href: '/admin/editeur', label: 'Éditeur de fiches' },
                        ...(profil.role === 'admin' ? [
                          { href: '/admin/import', label: 'Importer' },
                          { href: '/admin/corbeille', label: 'Corbeille' },
                          { href: '/admin/utilisateurs', label: 'Utilisateurs' },
                        ] : []),
                      ].map(({ href, label }) => (
                        <Link key={href} href={href} onClick={() => setAdminOpen(false)} style={{
                          display: 'block', padding: '9px 14px', borderRadius: 8,
                          fontSize: 14, fontWeight: pathname.startsWith(href) ? 700 : 500,
                          color: pathname.startsWith(href) ? '#2A2018' : '#555',
                          background: pathname.startsWith(href) ? '#FCEFD3' : 'transparent',
                          textDecoration: 'none',
                        }}>
                          {label}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          {streak > 0 && (
            <span title={`${streak} jour${streak > 1 ? 's' : ''} d'affilée`} style={{
              display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 14,
              color: '#D94A30', background: '#FCE9E3', padding: '8px 14px', borderRadius: 999,
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}>
              🔥 {streak} jour{streak > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: '#DC4A2B',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 700, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Menu utilisateur"
          >
            {initiales}
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: 46, right: 0, width: 200,
              background: '#fff', border: '1px solid #F0E7D6', borderRadius: 14,
              boxShadow: '0 8px 24px -8px rgba(40,30,60,.18)',
              padding: '6px',
              zIndex: 200,
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0E7D6', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2018' }}>{profil?.email?.split('@')[0]}</div>
                <div style={{ fontSize: 12, color: '#9A8D72', marginTop: 2 }}>
                  {profil?.role === 'admin' ? 'Administrateur' : profil?.role === 'editeur' ? 'Éditeur' : 'Étudiant'}
                </div>
              </div>
              <button onClick={logout} style={{
                width: '100%', textAlign: 'left',
                padding: '9px 14px', borderRadius: 8,
                background: 'transparent', border: 'none',
                color: '#8A7E68', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
              }}>
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
