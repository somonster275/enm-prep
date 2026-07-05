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
  // Incrément ATOMIQUE côté serveur (RPC, migration 0035) : pas de course read-then-write.
  const { error } = await supabase.rpc('incr_activite', { p_jour: jour, p_delta: n })
  if (!error) return
  // Repli si la RPC n'existe pas encore (migration non exécutée) : ancien read-then-write.
  const { data } = await supabase
    .from('activite_jours').select('cartes')
    .eq('utilisateur_id', userId).eq('jour', jour).maybeSingle()
  if (data) {
    await supabase.from('activite_jours').update({ cartes: data.cartes + n })
      .eq('utilisateur_id', userId).eq('jour', jour)
  } else {
    await supabase.from('activite_jours').insert({ utilisateur_id: userId, jour, cartes: n })
  }
}

/** Période de pause (mode vacances) : les jours entre `debut` et `fin` (inclus) ne cassent pas la série. */
export type Pause = { debut: string; fin: string }

/**
 * Charge les périodes de pause de l'utilisateur (mode vacances).
 * Résilient : si la table `pauses` n'existe pas encore (migration 0031 non exécutée),
 * renvoie un tableau vide au lieu de planter — la série se calcule alors sans pause.
 */
export async function chargerPauses(userId: string): Promise<Pause[]> {
  try {
    const { data, error } = await supabase.from('pauses').select('debut, fin').eq('user_id', userId)
    if (error) return []
    return (data || []) as Pause[]
  } catch {
    return []
  }
}

/** Un jour (YYYY-MM-DD) est-il couvert par une pause déclarée ? */
export function estEnPause(jour: string, pauses: Pause[]): boolean {
  return pauses.some(p => jour >= p.debut && jour <= p.fin)
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
 *
 * Mode vacances : un jour couvert par une pause n'interrompt PAS la série (il est
 * simplement sauté — il ne casse pas la chaîne, mais ne compte pas non plus comme
 * un jour travaillé). L'étudiant peut ainsi prendre une pause sans perdre ses flammes.
 */
export function calculerStreak(activite: Record<string, number>, pauses: Pause[] = []): number {
  const actif = (d: Date) => (activite[ymd(d)] ?? 0) > 0
  const enPause = (d: Date) => estEnPause(ymd(d), pauses)
  const d = new Date()
  // Tolérance : si rien aujourd'hui (et pas en pause), on peut encore compter depuis hier.
  if (!actif(d) && !enPause(d)) {
    d.setDate(d.getDate() - 1)
    if (!actif(d) && !enPause(d)) return 0
  }
  let streak = 0
  let garde = 0 // garde-fou anti-boucle (une pause très longue ne fige pas le calcul)
  while (garde++ < 4000) {
    if (actif(d)) { streak++; d.setDate(d.getDate() - 1); continue }
    if (enPause(d)) { d.setDate(d.getDate() - 1); continue } // jour en pause : sauté, la chaîne continue
    break
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
