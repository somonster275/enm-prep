'use client'
import { useState } from 'react'

type Invite = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// Écouté dès le chargement du module : l'événement ne part qu'une fois, avant l'ouverture du menu.
let invite: Invite | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); invite = e as Invite })
  window.addEventListener('appinstalled', () => { invite = null })
}

/** Entrée « Installer l'app » du menu compte. Invisible si déjà installée ou si le navigateur ne sait pas installer. */
export default function InstallerApp({ style }: { style: React.CSSProperties }) {
  const [aide, setAide] = useState(false)
  const [, rafraichir] = useState(0)
  if (typeof window === 'undefined' || window.matchMedia('(display-mode: standalone)').matches) return null
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  if (!invite && !ios) return null

  const installer = async () => {
    if (!invite) { setAide(a => !a); return }
    await invite.prompt()
    if ((await invite.userChoice).outcome === 'accepted') invite = null
    rafraichir(n => n + 1)
  }
  return (
    <>
      <button onClick={installer} style={style}>Installer l&apos;app</button>
      {aide && (
        <div style={{ padding: '4px 14px 10px', fontSize: 12.5, lineHeight: 1.45, color: 'var(--c-annotation)' }}>
          Dans Safari, touche le bouton Partager puis « Sur l&apos;écran d&apos;accueil ».
        </div>
      )}
    </>
  )
}
