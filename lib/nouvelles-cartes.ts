import { ymd } from '@/lib/streaks'

/**
 * Plafond de nouvelles cartes (jamais vues) introduites par jour.
 *
 * La répétition espacée est efficace parce qu'elle étale l'apprentissage : découvrir
 * 400 fiches fraîches d'un coup crée une avalanche démotivante et casse la mémorisation.
 * On limite donc le nombre de NOUVELLES cartes par jour ; les cartes DUES (déjà vues,
 * à réviser) ne sont jamais plafonnées — il faut toujours pouvoir rattraper ses révisions.
 *
 * Le compteur est stocké côté navigateur (localStorage), par utilisateur et par jour —
 * même approche que l'onboarding. Simple, sans migration ; se réinitialise à minuit.
 */
export const LIMITE_NOUVELLES_PAR_JOUR = 45

function cle(userId: string): string {
  return `codex-nouvelles-${userId}-${ymd(new Date())}`
}

/** Combien de nouvelles cartes l'étudiant a déjà découvertes aujourd'hui. */
export function nouvellesVuesAujourdhui(userId: string): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(cle(userId)) || '0', 10) || 0
}

/** Combien de nouvelles cartes il peut encore découvrir aujourd'hui (0 si plafond atteint). */
export function nouvellesRestantes(userId: string): number {
  return Math.max(0, LIMITE_NOUVELLES_PAR_JOUR - nouvellesVuesAujourdhui(userId))
}

/** Ajuste le compteur du jour (+1 quand une nouvelle carte est notée, -1 en cas d'annulation). */
export function marquerNouvellesVues(userId: string, delta = 1): void {
  if (typeof window === 'undefined') return
  const n = Math.max(0, nouvellesVuesAujourdhui(userId) + delta)
  localStorage.setItem(cle(userId), String(n))
}
