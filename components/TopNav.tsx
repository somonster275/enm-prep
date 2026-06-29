'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { Profil } from '@/types'
import { chargerActivite, calculerStreak } from '@/lib/streaks'
import { LogoBadge } from '@/components/Logo'
import NotifCloche from '@/components/NotifCloche'
import { useIsMobile } from '@/lib/useIsMobile'

export default function TopNav() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [profil, setProfil] = useState<Profil | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [communauteOpen, setCommunauteOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
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

  // Ferme le tiroir mobile quand on change de page.
  useEffect(() => { setNavOpen(false); setAdminOpen(false); setCommunauteOpen(false) }, [pathname])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Initiales : prénom + nom si disponibles, sinon les 2 premières lettres de l'email.
  const initiales = (() => {
    const p = profil?.prenom?.trim()?.[0]
    const n = profil?.nom?.trim()?.[0]
    if (p || n) return `${p ?? ''}${n ?? ''}`.toUpperCase()
    return profil?.email ? profil.email.slice(0, 2).toUpperCase() : '?'
  })()
  // Nom affiché : « Prénom Nom » si disponible, sinon la partie locale de l'email.
  const nomAffiche = [profil?.prenom?.trim(), profil?.nom?.trim()].filter(Boolean).join(' ')
    || profil?.email?.split('@')[0] || ''
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Liens de navigation
  const liens: { href: string; label: string }[] = [
    { href: '/dashboard', label: 'Accueil' },
    { href: '/espaces', label: 'Espaces' },
    { href: '/cours', label: 'Cours' },
    { href: '/actualites', label: 'Actualités' },
    { href: '/cours-ia', label: 'Questions de cours' },
    { href: '/drive', label: 'Mon Drive' },
    ...(profil?.role === 'admin' ? [{ href: '/calendrier', label: 'Calendrier' }] : []),
  ]
  // Outils collaboratifs (regroupés sous « Communauté »).
  const liensCommunaute: { href: string; label: string }[] = [
    { href: '/duel', label: 'Duel' },
    { href: '/entraide', label: 'Entraide' },
    { href: '/forum', label: 'Forum' },
    { href: '/annales', label: 'Annales' },
    { href: '/classement', label: 'Classement' },
  ]
  const liensAdmin: { href: string; label: string }[] =
    (profil?.role === 'admin' || profil?.role === 'editeur')
      ? [
          { href: '/admin/editeur', label: 'Éditeur de fiches' },
          ...(profil?.role === 'admin' ? [
            { href: '/admin/defi', label: 'Défi de la semaine' },
            { href: '/admin/qcm', label: 'QCM' },
            { href: '/admin/remarques', label: 'Remarques' },
            { href: '/admin/import', label: 'Importer' },
            { href: '/admin/corbeille', label: 'Corbeille' },
            { href: '/admin/utilisateurs', label: 'Utilisateurs' },
          ] : []),
        ]
      : []

  const navLink = (href: string, label: string) => (
    <Link key={href} href={href} style={{
      fontSize: 14, fontWeight: isActive(href) ? 700 : 600,
      color: isActive(href) ? '#2A2018' : '#8A7E68',
      background: isActive(href) ? '#FCEFD3' : 'transparent',
      padding: '9px 16px', borderRadius: 10, textDecoration: 'none',
    }}>
      {label}
    </Link>
  )

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #F0E7D6', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 16px' : '0 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <LogoBadge size={18} />
          </Link>

          {/* Navigation horizontale — desktop uniquement */}
          {!isMobile && (
            <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {liens.map(l => navLink(l.href, l.label))}

              {/* Menu Communauté */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setCommunauteOpen(o => !o)} style={{
                  fontSize: 14, fontWeight: 600,
                  color: liensCommunaute.some(l => pathname.startsWith(l.href)) ? '#2A2018' : '#8A7E68',
                  background: liensCommunaute.some(l => pathname.startsWith(l.href)) ? '#FCEFD3' : 'transparent',
                  padding: '9px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontFamily: "'Hanken Grotesk', sans-serif", display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  Communauté
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {communauteOpen && (
                  <>
                    <div onClick={() => setCommunauteOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                    <div style={{ position: 'absolute', top: 44, left: 0, minWidth: 170, zIndex: 200, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, boxShadow: '0 8px 24px -8px rgba(40,30,60,.18)', padding: 6 }}>
                      {liensCommunaute.map(({ href, label }) => (
                        <Link key={href} href={href} onClick={() => setCommunauteOpen(false)} style={{
                          display: 'block', padding: '9px 14px', borderRadius: 8,
                          fontSize: 14, fontWeight: pathname.startsWith(href) ? 700 : 500,
                          color: pathname.startsWith(href) ? '#2A2018' : '#555',
                          background: pathname.startsWith(href) ? '#FCEFD3' : 'transparent', textDecoration: 'none',
                        }}>{label}</Link>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {liensAdmin.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setAdminOpen(o => !o)} style={{
                    fontSize: 14, fontWeight: 600,
                    color: liensAdmin.some(l => pathname.startsWith(l.href)) ? '#2A2018' : '#8A7E68',
                    background: liensAdmin.some(l => pathname.startsWith(l.href)) ? '#FCEFD3' : 'transparent',
                    padding: '9px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontFamily: "'Hanken Grotesk', sans-serif", display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    Admin
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {adminOpen && (
                    <>
                      <div onClick={() => setAdminOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                      <div style={{ position: 'absolute', top: 44, left: 0, minWidth: 180, zIndex: 200, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, boxShadow: '0 8px 24px -8px rgba(40,30,60,.18)', padding: 6 }}>
                        {liensAdmin.map(({ href, label }) => (
                          <Link key={href} href={href} onClick={() => setAdminOpen(false)} style={{
                            display: 'block', padding: '9px 14px', borderRadius: 8,
                            fontSize: 14, fontWeight: pathname.startsWith(href) ? 700 : 500,
                            color: pathname.startsWith(href) ? '#2A2018' : '#555',
                            background: pathname.startsWith(href) ? '#FCEFD3' : 'transparent', textDecoration: 'none',
                          }}>{label}</Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </nav>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, position: 'relative' }}>
          {streak > 0 && !isMobile && (
            <span title={`${streak} jour${streak > 1 ? 's' : ''} d'affilée`} style={{
              display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 14,
              color: '#D94A30', background: '#FCE9E3', padding: '8px 14px', borderRadius: 999,
            }}>🔥 {streak} jour{streak > 1 ? 's' : ''}</span>
          )}

          {/* Cloche de notifications */}
          <NotifCloche />

          {/* Avatar + menu compte */}
          <button onClick={() => setMenuOpen(o => !o)} style={{
            width: 38, height: 38, borderRadius: '50%', background: '#DC4A2B', color: '#fff',
            border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} aria-label="Menu utilisateur">{initiales}</button>

          {menuOpen && (
            <div style={{ position: 'absolute', top: 46, right: 0, width: 200, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 14, boxShadow: '0 8px 24px -8px rgba(40,30,60,.18)', padding: 6, zIndex: 200 }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0E7D6', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2018' }}>{nomAffiche}</div>
                <div style={{ fontSize: 12, color: '#9A8D72', marginTop: 2 }}>
                  {profil?.role === 'admin' ? 'Administrateur' : profil?.role === 'editeur' ? 'Éditeur' : 'Étudiant'}
                </div>
              </div>
              <Link href="/compte" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '9px 14px', borderRadius: 8, color: '#8A7E68', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Mon compte</Link>
              <button onClick={logout} style={{ width: '100%', textAlign: 'left', padding: '9px 14px', borderRadius: 8, background: 'transparent', border: 'none', color: '#8A7E68', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif" }}>Déconnexion</button>
            </div>
          )}

          {/* Hamburger — mobile uniquement */}
          {isMobile && (
            <button onClick={() => setNavOpen(o => !o)} aria-label="Menu" style={{
              width: 38, height: 38, borderRadius: 10, background: '#FDF6EA', border: '1px solid #F0E7D6',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2A2018" strokeWidth="2.2" strokeLinecap="round">
                {navOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tiroir de navigation mobile */}
      {isMobile && navOpen && (
        <div style={{ borderTop: '1px solid #F0E7D6', background: '#fff', padding: '8px 12px 14px' }}>
          {liens.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setNavOpen(false)} style={{
              display: 'block', padding: '12px 14px', borderRadius: 10, marginBottom: 2,
              fontSize: 15, fontWeight: isActive(l.href) ? 700 : 600,
              color: isActive(l.href) ? '#2A2018' : '#6E6456',
              background: isActive(l.href) ? '#FCEFD3' : 'transparent', textDecoration: 'none',
            }}>{l.label}</Link>
          ))}
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: '#B6A98C', padding: '12px 14px 6px' }}>COMMUNAUTÉ</div>
          {liensCommunaute.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setNavOpen(false)} style={{
              display: 'block', padding: '12px 14px', borderRadius: 10, marginBottom: 2,
              fontSize: 15, fontWeight: isActive(l.href) ? 700 : 600,
              color: isActive(l.href) ? '#2A2018' : '#6E6456',
              background: isActive(l.href) ? '#FCEFD3' : 'transparent', textDecoration: 'none',
            }}>{l.label}</Link>
          ))}
          {liensAdmin.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: '#B6A98C', padding: '12px 14px 6px' }}>ADMIN</div>
              {liensAdmin.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setNavOpen(false)} style={{
                  display: 'block', padding: '12px 14px', borderRadius: 10, marginBottom: 2,
                  fontSize: 15, fontWeight: pathname.startsWith(l.href) ? 700 : 600,
                  color: pathname.startsWith(l.href) ? '#2A2018' : '#6E6456',
                  background: pathname.startsWith(l.href) ? '#FCEFD3' : 'transparent', textDecoration: 'none',
                }}>{l.label}</Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
