'use client'
import { useEffect, useSyncExternalStore } from 'react'
import { vider } from '@/lib/hors-ligne'

const abonner = (f: () => void) => {
  window.addEventListener('online', f); window.addEventListener('offline', f)
  return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f) }
}

/** Service worker + envoi des écritures en attente au retour du réseau + bandeau « hors connexion ». */
export default function HorsLigne() {
  const enLigne = useSyncExternalStore(abonner, () => navigator.onLine, () => true)

  useEffect(() => {
    // En dev, le service worker gênerait le rechargement à chaud.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  useEffect(() => { if (enLigne) vider() }, [enLigne])

  if (enLigne) return null
  return (
    <div role="status" style={{ background: 'var(--c-encre)', color: 'var(--c-papier)', fontSize: 13, textAlign: 'center', padding: '7px 12px' }}>
      Hors connexion : « Mon espace » reste utilisable, tes changements seront envoyés au retour du réseau.
    </div>
  )
}
