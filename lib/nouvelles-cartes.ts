import { supabase } from '@/lib/supabase'
import { ymd } from '@/lib/streaks'

/**
 * Plafond de nouvelles cartes (jamais vues) introduites par jour.
 *
 * La répétition espacée est efficace parce qu'elle étale l'apprentissage : découvrir
 * 400 fiches fraîches d'un coup crée une avalanche démotivante et casse la mémorisation.
 * On limite donc le nombre de NOUVELLES cartes par jour ; les cartes DUES (déjà vues,
 * à réviser) ne sont jamais plafonnées.
 *
 * Le compteur est en BASE (table `nouvelles_jours`, migration 0035) : il est donc
 * cross-device et non contournable en navigation privée. Incrément atomique via RPC.
 * Résilient : si la table/RPC n'existe pas encore, aucun cap n'est appliqué (fail-open).
 */
export const LIMITE_NOUVELLES_PAR_JOUR = 45

/** Nombre de nouvelles cartes déjà découvertes aujourd'hui (lecture directe, RLS self). */
export async function nouvellesVuesAujourdhui(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.from('nouvelles_jours')
      .select('n').eq('user_id', userId).eq('jour', ymd(new Date())).maybeSingle()
    if (error) return 0
    return data?.n ?? 0
  } catch { return 0 }
}

/** Nouvelles cartes encore autorisées aujourd'hui (limite pleine si le compteur est indisponible). */
export async function nouvellesRestantes(userId: string): Promise<number> {
  const vues = await nouvellesVuesAujourdhui(userId)
  return Math.max(0, LIMITE_NOUVELLES_PAR_JOUR - vues)
}

/** Ajuste le compteur du jour de façon ATOMIQUE (+1 à la découverte, -1 à l'annulation). */
export async function marquerNouvellesVues(delta = 1): Promise<void> {
  try {
    await supabase.rpc('incr_nouvelles', { p_jour: ymd(new Date()), p_delta: delta })
  } catch { /* résilient : compteur indisponible → on n'échoue pas la révision */ }
}
