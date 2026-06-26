'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { Espace, Profil } from '@/types'

export default function Sidebar() {
  const pathname = usePathname()
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [profil, setProfil] = useState<Profil | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: esp } = await supabase.from('espaces').select('*').order('ordre')
      setEspaces(esp || [])

      let { data: prof } = await supabase.from('profils').select('*').eq('id', user.id).single()

      if (!prof) {
        const { data: newProf } = await supabase.from('profils').insert({
          id: user.id,
          email: user.email,
          role: 'etudiant'
        }).select().single()
        prof = newProf
      }

      setProfil(prof)
    }
    load()
  }, [])

  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/login' }
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const initiales = profil?.email
    ? profil.email.slice(0, 2).toUpperCase()
    : '?'

  const labelStyle = {
    fontSize: 10,
    color: '#999',
    fontWeight: 600 as const,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '0 0.5rem',
    marginBottom: 6,
  }

  const linkBase = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    borderRadius: 8,
    fontSize: 13,
    textDecoration: 'none',
    marginBottom: 2,
    transition: 'background 0.1s',
  }

  return (
    <div style={{
      width: 220,
      minHeight: '100vh',
      background: '#fff',
      borderRight: '0.5px solid #E5E5E5',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.25rem 0.875rem',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.75rem', padding: '0 0.5rem' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: '#534AB7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>ENM Prep</div>
      </div>

      <nav style={{ flex: 1 }}>
        <div style={labelStyle}>Général</div>
        <Link href="/dashboard" style={{
          ...linkBase,
          color: isActive('/dashboard') ? '#3C3489' : '#555',
          background: isActive('/dashboard') ? '#EEEDFE' : 'transparent',
          fontWeight: isActive('/dashboard') ? 500 : 400,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Tableau de bord
        </Link>

        <Link href="/cours-ia" style={{
          ...linkBase,
          color: isActive('/cours-ia') ? '#3C3489' : '#555',
          background: isActive('/cours-ia') ? '#EEEDFE' : 'transparent',
          fontWeight: isActive('/cours-ia') ? 500 : 400,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
          Questions de cours
        </Link>

        <div style={{ ...labelStyle, margin: '10px 0 6px' }}>Espaces</div>
        {espaces.map(e => (
          <Link key={e.id} href={`/espaces/${e.slug}`} style={{
            ...linkBase,
            color: isActive(`/espaces/${e.slug}`) ? '#1A1A1A' : '#666',
            background: isActive(`/espaces/${e.slug}`) ? '#F5F5F5' : 'transparent',
            fontWeight: isActive(`/espaces/${e.slug}`) ? 500 : 400,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.couleur, flexShrink: 0 }} />
            {e.nom}
          </Link>
        ))}

        {profil && (profil.role === 'admin' || profil.role === 'editeur') && (
          <>
            <div style={{ ...labelStyle, margin: '10px 0 6px' }}>Admin</div>
            <Link href="/admin/editeur" style={{
              ...linkBase,
              color: isActive('/admin/editeur') ? '#3C3489' : '#666',
              background: isActive('/admin/editeur') ? '#EEEDFE' : 'transparent',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Éditeur de fiches
            </Link>
            {profil.role === 'admin' && (
              <Link href="/admin/utilisateurs" style={{
                ...linkBase,
                color: isActive('/admin/utilisateurs') ? '#3C3489' : '#666',
                background: isActive('/admin/utilisateurs') ? '#EEEDFE' : 'transparent',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Utilisateurs
              </Link>
            )}
          </>
        )}
      </nav>

      <div style={{ borderTop: '0.5px solid #E5E5E5', paddingTop: '0.875rem', marginTop: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#EEEDFE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: '#534AB7', flexShrink: 0,
          }}>
            {initiales}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profil?.email?.split('@')[0] || '—'}
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>
              {profil?.role === 'admin' ? 'Administrateur' : profil?.role === 'editeur' ? 'Éditeur' : 'Étudiant'}
            </div>
          </div>
        </div>
        <button onClick={logout} style={{
          width: '100%', marginTop: 4,
          padding: '7px', borderRadius: 8,
          background: 'transparent', border: '0.5px solid #E5E5E5',
          color: '#888', cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Déconnexion
        </button>
      </div>
    </div>
  )
}
