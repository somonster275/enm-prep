import type { Progression } from '@/types'

export const NIVEAUX = [
  { label: 'À revoir',      couleur: '#E24B4A', bg: '#FCEBEB', jours: 0  },
  { label: 'Intermédiaire', couleur: '#BA7517', bg: '#FAEEDA', jours: 3  },
  { label: 'Bien',          couleur: '#185FA5', bg: '#E6F1FB', jours: 7  },
  { label: 'Parfait',       couleur: '#0F6E56', bg: '#E1F5EE', jours: 21 },
]

export function prochaineRevision(niveau: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + NIVEAUX[niveau].jours)
  return date
}

export function estDue(prochaine_revision: string): boolean {
  return new Date() >= new Date(prochaine_revision)
}

export function scoreGlobal(progressions: Progression[]): number {
  if (!progressions.length) return 0
  const total = progressions.reduce((s, p) => s + p.niveau, 0)
  return Math.round((total / (progressions.length * 3)) * 100)
}