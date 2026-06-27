'use client'
import { useEffect, useState } from 'react'

/** Vrai quand la largeur de l'écran est ≤ breakpoint (768px par défaut).
 *  Rendu initial = false (desktop) pour rester cohérent avec le SSR, puis
 *  corrigé au montage côté client. */
export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpoint])
  return mobile
}
