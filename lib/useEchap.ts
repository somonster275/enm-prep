import { useEffect } from 'react'

/** Ferme une modale avec la touche Échap tant qu'elle est ouverte. */
export function useEchap(ouvert: boolean, fermer: () => void) {
  useEffect(() => {
    if (!ouvert) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ouvert, fermer])
}
