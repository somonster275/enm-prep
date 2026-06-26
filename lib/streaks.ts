import { supabase } from '@/lib/supabase'

/** Objectif quotidien de cartes révisées (pour la barre "Objectif du jour"). */
export const OBJECTIF_QUOTIDIEN = 20

/** Date locale au format YYYY-MM-DD (cohérent avec le type DATE de Postgres). */
export function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Enregistre l'activité du jour (incrémente le compteur de cartes révisées). */
export async function enregistrerActivite(userId: string, n = 1): Promise<void> {
  const jour = ymd(new Date())
  const { data } = await supabase
    .from('activite_jours')
    .select('cartes')
    .eq('utilisateur_id', userId)
    .eq('jour', jour)
    .maybeSingle()
  if (data) {
    await supabase.from('activite_jours').update({ cartes: data.cartes + n })
      .eq('utilisateur_id', userId).eq('jour', jour)
  } else {
    await supabase.from('activite_jours').insert({ utilisateur_id: userId, jour, cartes: n })
  }
}

/** Charge l'activité des 60 derniers jours → map { 'YYYY-MM-DD': nbCartes }. */
export async function chargerActivite(userId: string): Promise<Record<string, number>> {
  const since = new Date()
  since.setDate(since.getDate() - 60)
  const { data } = await supabase
    .from('activite_jours')
    .select('jour, cartes')
    .eq('utilisateur_id', userId)
    .gte('jour', ymd(since))
  const map: Record<string, number> = {}
  for (const r of (data || []) as { jour: string; cartes: number }[]) map[r.jour] = r.cartes
  return map
}

/**
 * Calcule la série en cours (jours consécutifs travaillés).
 * La série reste valide si l'utilisateur a travaillé aujourd'hui OU hier
 * (il a encore la journée pour la prolonger).
 */
export function calculerStreak(activite: Record<string, number>): number {
  const actif = (d: Date) => (activite[ymd(d)] ?? 0) > 0
  const d = new Date()
  if (!actif(d)) {
    d.setDate(d.getDate() - 1)
    if (!actif(d)) return 0
  }
  let streak = 0
  while (actif(d)) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** Plus longue série historique sur la fenêtre chargée. */
export function meilleurStreak(activite: Record<string, number>): number {
  const jours = Object.keys(activite).filter(j => activite[j] > 0).sort()
  let best = 0, cur = 0, prev: Date | null = null
  for (const j of jours) {
    const d = new Date(j + 'T00:00:00')
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000)
      cur = diff === 1 ? cur + 1 : 1
    } else cur = 1
    best = Math.max(best, cur)
    prev = d
  }
  return best
}

/** Les 7 derniers jours (du plus ancien au plus récent) pour le graphique momentum. */
export function derniers7Jours(activite: Record<string, number>) {
  const lettres = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] // dimanche → samedi
  const out: { lettre: string; cartes: number; estAujourdhui: boolean }[] = []
  const today = ymd(new Date())
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push({
      lettre: lettres[d.getDay()],
      cartes: activite[ymd(d)] ?? 0,
      estAujourdhui: ymd(d) === today,
    })
  }
  return out
}

/** Nombre de cartes révisées aujourd'hui. */
export function cartesAujourdhui(activite: Record<string, number>): number {
  return activite[ymd(new Date())] ?? 0
}
