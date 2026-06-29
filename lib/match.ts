import { supabase } from '@/lib/supabase'

// Une question de match, format unifié (QCM existant OU fiche convertie).
export type MatchOption = { t: string; c: boolean }
// `ficheId` / `qcmId`+`qId` : origine de la question, conservée pour le débrief
// et pour ranger les erreurs dans les cartes à réviser (jamais envoyée au client).
export type MatchQuestion = {
  enonce: string; options: MatchOption[]; cat: 'qcm' | 'fiche'
  ficheId?: string; qcmId?: string; qId?: string
}

const POINTS_BASE = 100        // points d'une bonne réponse
const POINTS_VITESSE = 50      // bonus max pour la rapidité (proportionnel au temps restant)

const melange = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)
const sansHtml = (s: string) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// Convertit le HTML en texte en préservant les ruptures de blocs (paragraphes,
// listes, sauts de ligne) sous forme de '\n' — pour pouvoir couper proprement.
const htmlVersTexte = (s: string): string => (s || '')
  .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .split('\n').map(l => l.trim()).filter(Boolean).join('\n')

// Découpe un texte en phrases (fin de phrase OU saut de ligne / paragraphe).
const decouperPhrases = (texte: string): string[] =>
  texte.split(/(?<=[.!?…»])\s+|\n+/).map(s => s.trim()).filter(Boolean)

// Produit une proposition lisible : des PHRASES ENTIÈRES jusqu'à ~maxLen, jamais
// coupées en plein milieu. Ajoute « […] » s'il reste du texte ensuite. Une seule
// phrase trop longue est, en dernier recours, coupée au dernier mot.
const extraitLisible = (brut: string, maxLen = 280): string => {
  const texte = htmlVersTexte(brut)
  if (texte.length <= maxLen) return texte

  const phrases = decouperPhrases(texte)
  let out = ''
  for (const p of phrases) {
    if (!out) { out = p; continue }
    if ((out + ' ' + p).length > maxLen) break
    out += ' ' + p
  }
  // Cas limite : la première phrase dépasse déjà maxLen → coupe au dernier mot.
  if (out.length > maxLen) {
    const coupe = out.slice(0, maxLen)
    const dernierEspace = coupe.lastIndexOf(' ')
    out = (dernierEspace > 60 ? coupe.slice(0, dernierEspace) : coupe).trim()
  }
  // Indique qu'il y a une suite (toute la fiche n'est pas affichée).
  return out.replace(/[.,;:\s]+$/, '') + ' […]'
}

// ---- Similarité lexicale (pour des leurres crédibles, sans appel IA) ----
// Mots vides ignorés : ils n'apportent pas de signal de proximité thématique.
const STOP = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'et', 'ou', 'en',
  'dans', 'par', 'pour', 'sur', 'que', 'qui', 'quoi', 'dont', 'est', 'sont', 'etre',
  'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses', 'leur', 'leurs', 'il', 'elle',
  'ils', 'elles', 'on', 'se', 'ne', 'pas', 'plus', 'avec', 'sans', 'mais', 'donc',
  'a', 'as', 'ai', 'ont', 'fait', 'faire', 'tout', 'tous', 'toute', 'toutes',
])
const tokeniser = (s: string): Set<string> => new Set(
  (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w)),
)
// Indice de Jaccard pondéré : proportion de mots significatifs partagés.
const similariteTokens = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const w of a) if (b.has(w)) inter++
  return inter / (a.size + b.size - inter)
}

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

// Une entrée du « réservoir » de réponses servant à fabriquer des leurres.
type PoolItem = { rep: string; moduleId: string; tokens: Set<string> }

// Convertit une fiche (question/réponse libre) en QCM « trouve la bonne réponse ».
// Les 3 leurres sont choisis pour RESSEMBLER à la bonne réponse (similarité
// lexicale + bonus même module), afin que le choix soit réellement difficile —
// plutôt que des réponses sans rapport, faciles à éliminer.
function ficheVersQuestion(
  fiche: { id: string; question: string; reponse: string; moduleId: string },
  pool: PoolItem[],
): MatchQuestion | null {
  const bonne = extraitLisible(fiche.reponse, 280)
  const enonce = extraitLisible(fiche.question, 320)
  if (!bonne || !enonce) return null

  const tokBonne = tokeniser(bonne)
  // Score chaque réponse candidate par sa proximité avec la bonne réponse.
  const candidats = pool
    .filter(p => p.rep && p.rep !== bonne)
    .map(p => {
      const sim = similariteTokens(tokBonne, p.tokens)
      const bonusModule = p.moduleId === fiche.moduleId ? 0.15 : 0 // même chapitre = plus proche
      return { rep: p.rep, score: sim + bonusModule }
    })
    .sort((a, b) => b.score - a.score)

  if (candidats.length < 2) return null // pas assez de matière pour des leurres crédibles

  // On pioche dans une fenêtre des plus proches (un peu de hasard pour varier les
  // duels), en évitant les doublons de texte.
  const fenetre = candidats.slice(0, Math.min(8, candidats.length))
  const vus = new Set<string>()
  const leurres: string[] = []
  for (const c of melange(fenetre)) {
    if (vus.has(c.rep)) continue
    vus.add(c.rep); leurres.push(c.rep)
    if (leurres.length >= 3) break
  }
  // Complète si besoin avec les meilleurs scores restants (hors fenêtre).
  for (const c of candidats) {
    if (leurres.length >= 3) break
    if (!vus.has(c.rep)) { vus.add(c.rep); leurres.push(c.rep) }
  }
  if (leurres.length < 2) return null

  const options = melange([{ t: bonne, c: true }, ...leurres.map(t => ({ t, c: false }))])
  return { enonce, options, cat: 'fiche', ficheId: fiche.id }
}

// Construit le paquet figé du match à partir d'un QCM et/ou d'un espace de fiches.
// `nb` = nombre de questions souhaité (mélange des deux sources, plafonné).
export async function construireDeck(opts: {
  qcmId?: string | null
  espaceId?: string | null
  moduleId?: string | null   // restreint les fiches à un module/chapitre précis
  nb: number
}): Promise<MatchQuestion[]> {
  const lots: MatchQuestion[] = []

  // --- Source 1 : QCM existant ---
  if (opts.qcmId) {
    const { data } = await supabase.from('qcm_questions')
      .select('id, enonce, options').eq('qcm_id', opts.qcmId)
    for (const q of (data || []) as { id: string; enonce: string; options: MatchOption[] }[]) {
      if (q.enonce && Array.isArray(q.options) && q.options.length >= 2 && q.options.some(o => o.c)) {
        lots.push({ enonce: sansHtml(q.enonce), options: q.options, cat: 'qcm', qcmId: opts.qcmId, qId: q.id })
      }
    }
  }

  // --- Source 2 : fiches d'un espace (ou d'un module précis), converties en QCM ---
  if (opts.espaceId || opts.moduleId) {
    // Si un module est choisi, on ne prend que celui-ci (+ ses sous-modules) ;
    // sinon tous les modules de la matière.
    let modIds: string[]
    if (opts.moduleId) {
      const { data: enfants } = await supabase.from('modules').select('id').eq('parent_id', opts.moduleId).is('deleted_at', null)
      modIds = [opts.moduleId, ...(enfants || []).map((m: { id: string }) => m.id)]
    } else {
      const { data: mods } = await supabase.from('modules').select('id').eq('espace_id', opts.espaceId).is('deleted_at', null)
      modIds = (mods || []).map((m: { id: string }) => m.id)
    }
    if (modIds.length > 0) {
      const { data: fiches } = await supabase.from('fiches')
        .select('id, question, reponse, module_id').in('module_id', modIds).is('deleted_at', null).eq('suspendu', false)
      const fl = (fiches || []) as { id: string; question: string; reponse: string; module_id: string }[]
      // Réservoir de leurres : chaque réponse avec son module et ses mots-clés
      // (pré-tokenisés une seule fois pour ne pas recalculer à chaque question).
      const pool: PoolItem[] = fl
        .map(f => ({ rep: extraitLisible(f.reponse, 280), moduleId: f.module_id }))
        .filter(p => p.rep)
        .map(p => ({ ...p, tokens: tokeniser(p.rep) }))
      for (const f of melange(fl)) {
        const q = ficheVersQuestion({ id: f.id, question: f.question, reponse: f.reponse, moduleId: f.module_id }, pool)
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
