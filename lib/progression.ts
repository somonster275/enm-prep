import { scoreGlobal } from '@/lib/spaced-repetition'

/**
 * Progression globale = moyenne pondérée de 3 dimensions (chacune sur 100) :
 *  - maîtrise   : avancement dans la répétition espacée (mémorisation réelle)
 *  - couverture : part du programme (modules) au moins entamée
 *  - régularité : assiduité sur les 7 derniers jours (objectif quotidien atteint)
 *
 * Poids ajustables ici.
 */
export const POIDS = { maitrise: 0.5, couverture: 0.3, regularite: 0.2 }
export const OBJECTIF_QUOTIDIEN = 20

export type DetailProgression = {
  global: number
  maitrise: number
  couverture: number
  regularite: number
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Régularité : moyenne sur 7 jours du taux d'atteinte de l'objectif quotidien (0-100). */
export function regulariteScore(activite: Record<string, number>): number {
  let somme = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    somme += Math.min((activite[ymd(d)] ?? 0) / OBJECTIF_QUOTIDIEN, 1)
  }
  return Math.round((somme / 7) * 100)
}

export function calculerProgression(p: {
  progressions: { palier: number | null }[]
  modulesTotal: number
  modulesAbordes: number
  activite: Record<string, number>
}): DetailProgression {
  const maitrise = scoreGlobal(p.progressions as never)
  const couverture = p.modulesTotal > 0 ? Math.round((p.modulesAbordes / p.modulesTotal) * 100) : 0
  const regularite = regulariteScore(p.activite)
  const global = Math.round(POIDS.maitrise * maitrise + POIDS.couverture * couverture + POIDS.regularite * regularite)
  return { global, maitrise, couverture, regularite }
}
