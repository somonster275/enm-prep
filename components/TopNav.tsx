'use client'
import Link from 'next/link'
import InstallerApp from '@/components/InstallerApp'
import { oublierCopieLocale } from '@/lib/hors-ligne'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { Profil } from '@/types'
import { chargerActivite, calculerStreak, chargerPauses } from '@/lib/streaks'
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
  const [ressourcesOpen, setRessourcesOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('profils').select('*').eq('id', user.id).maybeSingle()
      if (error) return // lecture en échec ≠ profil absent : ne pas tenter de le recréer
      let prof = data
      if (!prof) {
        const { data: newProf } = await supabase.from('profils').insert({
          id: user.id, email: user.email, role: 'lecteur'
        }).select().single()
        prof = newProf
      }
      setProfil(prof)
      const [activite, pauses] = await Promise.all([chargerActivite(user.id), chargerPauses(user.id)])
      setStreak(calculerStreak(activite, pauses))
    }
    load()
  }, [pathname])

  // Ferme le tiroir mobile quand on change de page.
  useEffect(() => { setNavOpen(false); setAdminOpen(false); setCommunauteOpen(false); setRessourcesOpen(false) }, [pathname])

  const logout = async () => {
    await supabase.auth.signOut()
    await oublierCopieLocale() // le prochain compte de ce navigateur ne doit pas voir « Mon espace » de celui-ci
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

  // Liens de premier niveau (l'essentiel, pour ne pas surcharger la barre).
  const liens: { href: string; label: string }[] = [
    { href: '/dashboard', label: 'Accueil' },
    { href: '/espaces', label: 'Espaces' },
    { href: '/mon-espace', label: 'Mon espace' },
    { href: '/actualites', label: 'Actualités' },
  ]
  // Ressources pédagogiques (regroupées sous « Ressources »).
  const liensRessources: { href: string; label: string }[] = [
    { href: '/cours', label: 'Cours' },
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
    { href: '/contribuer', label: 'Proposer un contenu' },
    { href: '/classement', label: 'Classement' },
  ]
  const liensAdmin: { href: string; label: string }[] =
    (profil?.role === 'admin' || profil?.role === 'editeur')
      ? [
          { href: '/admin/editeur', label: 'Éditeur de fiches' },
          ...(profil?.role === 'admin' ? [
            { href: '/admin/defi', label: 'Défi de la semaine' },
            { href: '/admin/qcm', label: 'QCM' },
            { href: '/admin/contributions', label: 'Contributions' },
            { href: '/admin/remarques', label: 'Remarques' },
            { href: '/admin/import', label: 'Importer' },
            { href: '/admin/corbeille', label: 'Corbeille' },
            { href: '/admin/utilisateurs', label: 'Utilisateurs' },
          ] : []),
        ]
      : []

  const navLink = (href: string, label: string) => (
    <Link key={href} href={href} style={{
      fontSize: 14.5, fontWeight: isActive(href) ? 600 : 500,
      color: isActive(href) ? 'var(--c-encre)' : 'var(--c-annotation)',
      boxShadow: isActive(href) ? 'inset 0 -2px 0 var(--c-accent)' : 'none',
      padding: '21px 10px', textDecoration: 'none',
    }}>
      {label}
    </Link>
  )

  // Menu déroulant générique (Ressources, Communauté, Admin) — factorisé pour
  // garder la barre lisible et aérée.
  const menuDeroulant = (
    label: string,
    items: { href: string; label: string }[],
    open: boolean,
    setOpen: (v: boolean) => void,
  ) => {
    const actif = items.some(l => pathname.startsWith(l.href))
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{
          fontSize: 14.5, fontWeight: actif ? 600 : 500,
          color: actif ? 'var(--c-encre)' : 'var(--c-annotation)',
          background: 'transparent', boxShadow: actif ? 'inset 0 -2px 0 var(--c-accent)' : 'none',
          padding: '21px 10px', border: 'none', cursor: 'pointer',
          fontFamily: "var(--font-texte)", display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
            <div style={{ position: 'absolute', top: 60, left: 0, minWidth: 200, zIndex: 200, background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, boxShadow: '0 8px 24px -8px rgba(40,30,60,.18)', padding: 6 }}>
              {items.map(({ href, label }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} style={{
                  display: 'block', padding: '9px 14px', borderRadius: 4,
                  fontSize: 14, fontWeight: pathname.startsWith(href) ? 600 : 500,
                  color: pathname.startsWith(href) ? 'var(--c-encre)' : 'var(--c-texte-doux)',
                  background: pathname.startsWith(href) ? 'var(--c-papier-teinte)' : 'transparent', textDecoration: 'none',
                }}>{label}</Link>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: '#FFFEFB', borderBottom: '1px solid var(--c-filet)', position: 'sticky', top: 0, zIndex: 100 }}>
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
            <nav style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {liens.map(l => navLink(l.href, l.label))}
              {menuDeroulant('Ressources', liensRessources, ressourcesOpen, setRessourcesOpen)}
              {menuDeroulant('Communauté', liensCommunaute, communauteOpen, setCommunauteOpen)}
              {liensAdmin.length > 0 && menuDeroulant('Admin', liensAdmin, adminOpen, setAdminOpen)}
            </nav>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, position: 'relative' }}>
          {streak > 0 && !isMobile && (
            <span title={`${streak} jour${streak > 1 ? 's' : ''} d'affilée`} style={{
              fontSize: 14, color: 'var(--c-annotation)',
            }}><b style={{ fontFamily: 'var(--font-titre)', fontSize: 17, fontWeight: 600, color: 'var(--c-encre)' }}>{streak}</b> jour{streak > 1 ? 's' : ''} d&apos;affilée</span>
          )}

          {/* Cloche de notifications */}
          <NotifCloche />

          {/* Avatar + menu compte */}
          <button onClick={() => setMenuOpen(o => !o)} style={{
            width: 36, height: 36, borderRadius: '50%', background: 'var(--c-encre)', color: 'var(--c-papier)',
            border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} aria-label="Menu utilisateur">{initiales}</button>

          {menuOpen && (
            <div style={{ position: 'absolute', top: 46, right: 0, width: 200, background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, boxShadow: '0 8px 24px -8px rgba(40,30,60,.18)', padding: 6, zIndex: 200 }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--c-filet)', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-encre)' }}>{nomAffiche}</div>
                <div style={{ fontSize: 12, color: 'var(--c-annotation-clair)', marginTop: 2 }}>
                  {profil?.role === 'admin' ? 'Administrateur' : profil?.role === 'editeur' ? 'Éditeur' : 'Étudiant'}
                </div>
              </div>
              <Link href="/compte" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '9px 14px', borderRadius: 8, color: 'var(--c-annotation)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Mon compte</Link>
              <InstallerApp style={{ width: '100%', textAlign: 'left', padding: '9px 14px', borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--c-annotation)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "var(--font-texte)" }} />
              <button onClick={logout} style={{ width: '100%', textAlign: 'left', padding: '9px 14px', borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--c-annotation)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "var(--font-texte)" }}>Déconnexion</button>
            </div>
          )}

          {/* Hamburger — mobile uniquement */}
          {isMobile && (
            <button onClick={() => setNavOpen(o => !o)} aria-label="Menu" style={{
              width: 38, height: 38, borderRadius: 6, background: 'transparent', border: '1px solid var(--c-filet-fort)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#211C19" strokeWidth="2.2" strokeLinecap="round">
                {navOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tiroir de navigation mobile */}
      {isMobile && navOpen && (
        <div style={{ borderTop: '1px solid var(--c-filet)', background: '#FFFEFB', padding: '8px 12px 14px' }}>
          {liens.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setNavOpen(false)} style={{
              display: 'block', padding: '11px 14px', marginBottom: 2,
              fontSize: 15, fontWeight: isActive(l.href) ? 600 : 500,
              color: isActive(l.href) ? 'var(--c-encre)' : 'var(--c-texte-doux)',
              borderLeft: `2px solid ${isActive(l.href) ? 'var(--c-accent)' : 'transparent'}`, textDecoration: 'none',
            }}>{l.label}</Link>
          ))}
          <div style={{ fontFamily: 'var(--font-titre)', fontSize: 15, fontWeight: 600, color: 'var(--c-annotation)', padding: '14px 14px 4px' }}>Ressources</div>
          {liensRessources.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setNavOpen(false)} style={{
              display: 'block', padding: '11px 14px', marginBottom: 2,
              fontSize: 15, fontWeight: isActive(l.href) ? 600 : 500,
              color: isActive(l.href) ? 'var(--c-encre)' : 'var(--c-texte-doux)',
              borderLeft: `2px solid ${isActive(l.href) ? 'var(--c-accent)' : 'transparent'}`, textDecoration: 'none',
            }}>{l.label}</Link>
          ))}
          <div style={{ fontFamily: 'var(--font-titre)', fontSize: 15, fontWeight: 600, color: 'var(--c-annotation)', padding: '14px 14px 4px' }}>Communauté</div>
          {liensCommunaute.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setNavOpen(false)} style={{
              display: 'block', padding: '11px 14px', marginBottom: 2,
              fontSize: 15, fontWeight: isActive(l.href) ? 600 : 500,
              color: isActive(l.href) ? 'var(--c-encre)' : 'var(--c-texte-doux)',
              borderLeft: `2px solid ${isActive(l.href) ? 'var(--c-accent)' : 'transparent'}`, textDecoration: 'none',
            }}>{l.label}</Link>
          ))}
          {liensAdmin.length > 0 && (
            <>
              <div style={{ fontFamily: 'var(--font-titre)', fontSize: 15, fontWeight: 600, color: 'var(--c-annotation)', padding: '14px 14px 4px' }}>Admin</div>
              {liensAdmin.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setNavOpen(false)} style={{
                  display: 'block', padding: '11px 14px', marginBottom: 2,
                  fontSize: 15, fontWeight: pathname.startsWith(l.href) ? 600 : 500,
                  color: pathname.startsWith(l.href) ? 'var(--c-encre)' : 'var(--c-texte-doux)',
                  borderLeft: `2px solid ${pathname.startsWith(l.href) ? 'var(--c-accent)' : 'transparent'}`, textDecoration: 'none',
                }}>{l.label}</Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
