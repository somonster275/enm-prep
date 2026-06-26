import type { Progression } from '@/types'

const H = 60      // minutes dans une heure
const J = 1440    // minutes dans un jour

/**
 * Échelonnage façon Anki, resserré pour la mémorisation.
 *
 * Chaque carte possède un « palier » = combien de fois elle a été revue avec succès
 * d'affilée (0 = première vue ou fraîchement réinitialisée). L'index dans chaque
 * tableau `intervalles` correspond à ce palier : plus le palier monte, plus
 * l'intervalle s'allonge.
 *
 * Bouton 0 « À revoir » : reste toujours dans la journée ET réinitialise le palier à 0
 * (on repart d'une base très répétitive). Les boutons 1-3 font monter le palier d'un cran.
 *
 * Première vue (palier 0) :  1 min · 15 min · 1 j · 5 j   (comme demandé)
 * Deuxième vue (palier 1) :  1 min · 1 h  · 3 j · 12 j   (les taux augmentent)
 * etc.
 */
export const NIVEAUX = [
  { label: 'À revoir',  couleur: '#E24B4A', bg: '#FCEBEB', reset: true,  intervalles: [1] },
  { label: 'Difficile', couleur: '#BA7517', bg: '#FAEEDA', reset: false, intervalles: [15, 1 * H, 3 * H, 8 * H, 1 * J, 2 * J] },
  { label: 'Correct',   couleur: '#185FA5', bg: '#E6F1FB', reset: false, intervalles: [1 * J, 3 * J, 7 * J, 16 * J, 35 * J, 70 * J] },
  { label: 'Facile',    couleur: '#0F6E56', bg: '#E1F5EE', reset: false, intervalles: [5 * J, 12 * J, 30 * J, 75 * J, 180 * J, 365 * J] },
]

// Palier maximum (au-delà, l'intervalle est plafonné sur la dernière valeur).
export const PALIER_MAX = 5

/** Intervalle (en minutes) que donnera ce bouton pour une carte à ce palier. */
export function intervalleMinutes(bouton: number, palier: number): number {
  const arr = NIVEAUX[bouton].intervalles
  return arr[Math.min(palier, arr.length - 1)]
}

/** Nouveau palier de la carte après avoir pressé ce bouton. */
export function palierApres(bouton: number, palier: number): number {
  if (NIVEAUX[bouton].reset) return 0
  return Math.min(palier + 1, PALIER_MAX)
}

/** Date de prochaine révision à partir du bouton pressé et du palier actuel de la carte. */
export function prochaineRevision(bouton: number, palier: number): Date {
  const d = new Date()
  d.setMinutes(d.getMinutes() + intervalleMinutes(bouton, palier))
  return d
}

export function estDue(prochaine_revision: string): boolean {
  return new Date() >= new Date(prochaine_revision)
}

/** Met un intervalle (en minutes) sous forme lisible : « 15 min », « 3 h », « 5 j », « 2 mois »… */
export function formatIntervalle(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`
  const j = Math.round(minutes / 1440)
  if (j < 60) return `${j} j`
  if (j < 365) return `${Math.round(j / 30)} mois`
  const ans = Math.round(j / 365)
  return `${ans} an${ans > 1 ? 's' : ''}`
}

/** Score global = avancement moyen dans l'échelonnage (palier / PALIER_MAX). */
export function scoreGlobal(progressions: Progression[]): number {
  if (!progressions.length) return 0
  const total = progressions.reduce((s, p) => s + Math.min(p.palier ?? 0, PALIER_MAX), 0)
  return Math.round((total / (progressions.length * PALIER_MAX)) * 100)
}
