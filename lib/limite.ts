import type { NextRequest } from 'next/server'

// shortcut: compteur en mémoire, par instance serveur (remis à zéro à chaque démarrage à froid) ;
// suffit contre un envoi en boucle depuis une même IP, passer à une table Supabase si un vrai abus apparaît.
const coups = new Map<string, number[]>()

export function tropDeRequetes(request: NextRequest, cle: string, max: number, fenetreMs: number): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'inconnue'
  const k = `${cle}:${ip}`
  const maintenant = Date.now()
  const recents = (coups.get(k) || []).filter(t => maintenant - t < fenetreMs)
  if (coups.size > 10_000) coups.clear() // borne la mémoire
  if (recents.length >= max) { coups.set(k, recents); return true }
  recents.push(maintenant)
  coups.set(k, recents)
  return false
}
