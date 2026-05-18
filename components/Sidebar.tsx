'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Espace, Profil } from '@/types'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
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

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div style={{ width: 220, minHeight: '100vh', background: '#1A1630', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', flexShrink: 0 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: '2rem', padding: '0 0.5rem' }}>ENM Prep</div>
      <nav style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: '#666', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', padding: '0 0.5rem', marginBottom: 6 }}>Général</div>
        <Link href="/dashboard" style={{ display: 'block', padding: '8px 10px', borderRadius: 8, color: isActive('/dashboard') ? '#fff' : '#aaa', background: isActive('/dashboard') ? '#534AB7' : 'transparent', fontSize: 13, textDecoration: 'none', marginBottom: 2 }}>
          Tableau de bord
        </Link>
        <div style={{ fontSize: 10, color: '#666', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', padding: '0 0.5rem', margin: '12px 0 6px' }}>Espaces</div>
        {espaces.map(e => (
          <Link key={e.id} href={`/espaces/${e.slug}`}
            style={{ display: 'block', padding: '7px 10px', borderRadius: 8, color: isActive(`/espaces/${e.slug}`) ? '#fff' : '#aaa', background: isActive(`/espaces/${e.slug}`) ? '#2D2850' : 'transparent', fontSize: 13, textDecoration: 'none', marginBottom: 2, borderLeft: isActive(`/espaces/${e.slug}`) ? `3px solid ${e.couleur}` : '3px solid transparent' }}>
            {e.nom}
          </Link>
        ))}
        {profil && (profil.role === 'admin' || profil.role === 'editeur') && (
          <>
            <div style={{ fontSize: 10, color: '#666', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', padding: '0 0.5rem', margin: '12px 0 6px' }}>Admin</div>
            <Link href="/admin/editeur" style={{ display: 'block', padding: '7px 10px', borderRadius: 8, color: isActive('/admin/editeur') ? '#fff' : '#aaa', background: isActive('/admin/editeur') ? '#2D2850' : 'transparent', fontSize: 13, textDecoration: 'none', marginBottom: 2 }}>
              Éditeur de fiches
            </Link>
            {profil.role === 'admin' && (
              <Link href="/admin/utilisateurs" style={{ display: 'block', padding: '7px 10px', borderRadius: 8, color: isActive('/admin/utilisateurs') ? '#fff' : '#aaa', background: isActive('/admin/utilisateurs') ? '#2D2850' : 'transparent', fontSize: 13, textDecoration: 'none', marginBottom: 2 }}>
                Utilisateurs
              </Link>
            )}
          </>
        )}
      </nav>
      <div style={{ borderTop: '1px solid #2D2850', paddingTop: '1rem', marginTop: '1rem' }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8, padding: '0 0.5rem' }}>{profil?.email}</div>
        <button onClick={logout} style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: '1px solid #2D2850', color: '#888', cursor: 'pointer', fontSize: 12 }}>
          Déconnexion
        </button>
      </div>
    </div>
  )
}