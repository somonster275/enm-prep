import { supabase } from '@/lib/supabase'

// Une question de match, format unifié (QCM existant OU fiche convertie).
export type MatchOption = { t: string; c: boolean }
export type MatchQuestion = { enonce: string; options: MatchOption[]; cat: 'qcm' | 'fiche' }

const POINTS_BASE = 100        // points d'une bonne réponse
const POINTS_VITESSE = 50      // bonus max pour la rapidité (proportionnel au temps restant)

const melange = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)
const sansHtml = (s: string) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// Points gagnés pour une réponse, avec bonus de rapidité si elle est juste.
export function pointsReponse(juste: boolean, resteSecondes: number, totalSecondes: number): number {
  if (!juste) return 0
  const ratio = totalSecondes > 0 ? Math.max(0, Math.min(1, resteSecondes / totalSecondes)) : 0
  return POINTS_BASE + Math.round(POINTS_VITESSE * ratio)
}

// Vrai si la sélection du joueur correspond exactement aux bonnes réponses.
export function reponseJuste(q: MatchQuestion, choisi: Set<number>): boolean {
  const bonnes = new Set(q.options.map((o, i) => (o.c ? i : -1)).filter(i => i >= 0))
  if (choisi.size !== bonnes.size) return false
  for (const i of choisi) if (!bonnes.has(i)) return false
  return true
}

// Convertit une fiche (question/réponse libre) en QCM « trouve la bonne réponse » :
// la vraie réponse + 3 leurres tirés d'autres fiches de la même matière.
function ficheVersQuestion(
  fiche: { question: string; reponse: string },
  pool: string[],
): MatchQuestion | null {
  const bonne = sansHtml(fiche.reponse).slice(0, 220)
  const enonce = sansHtml(fiche.question).slice(0, 280)
  if (!bonne || !enonce) return null
  const leurres = melange(pool.filter(r => r && r !== bonne)).slice(0, 3)
  if (leurres.length < 2) return null // pas assez de matière pour des leurres crédibles
  const options = melange([{ t: bonne, c: true }, ...leurres.map(t => ({ t, c: false }))])
  return { enonce, options, cat: 'fiche' }
}

// Construit le paquet figé du match à partir d'un QCM et/ou d'un espace de fiches.
// `nb` = nombre de questions souhaité (mélange des deux sources, plafonné).
export async function construireDeck(opts: {
  qcmId?: string | null
  espaceId?: string | null
  nb: number
}): Promise<MatchQuestion[]> {
  const lots: MatchQuestion[] = []

  // --- Source 1 : QCM existant ---
  if (opts.qcmId) {
    const { data } = await supabase.from('qcm_questions')
      .select('enonce, options').eq('qcm_id', opts.qcmId)
    for (const q of (data || []) as { enonce: string; options: MatchOption[] }[]) {
      if (q.enonce && Array.isArray(q.options) && q.options.length >= 2 && q.options.some(o => o.c)) {
        lots.push({ enonce: sansHtml(q.enonce), options: q.options, cat: 'qcm' })
      }
    }
  }

  // --- Source 2 : fiches d'un espace, converties en QCM ---
  if (opts.espaceId) {
    const { data: mods } = await supabase.from('modules').select('id').eq('espace_id', opts.espaceId).is('deleted_at', null)
    const modIds = (mods || []).map((m: { id: string }) => m.id)
    if (modIds.length > 0) {
      const { data: fiches } = await supabase.from('fiches')
        .select('question, reponse').in('module_id', modIds).is('deleted_at', null)
      const fl = (fiches || []) as { question: string; reponse: string }[]
      const pool = fl.map(f => sansHtml(f.reponse).slice(0, 220)).filter(Boolean)
      for (const f of melange(fl)) {
        const q = ficheVersQuestion(f, pool)
        if (q) lots.push(q)
      }
    }
  }

  return melange(lots).slice(0, Math.max(1, opts.nb))
}

// Génère un code de salon court et lisible (sans caractères ambigus).
export function genererCode(): string {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += alpha[Math.floor(Math.random() * alpha.length)]
  return c
}
