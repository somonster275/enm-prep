import { supabase } from '@/lib/supabase'
import type { PersoModule, PersoElement, SourceType, TypeElement, Contenu } from '@/lib/espace-perso'

// Un « paquet » = une copie de « Mon espace » transportable : fichier exporté ou contenu d'un lien de partage.
// Il garde les liens vers l'officiel : la copie importée reçoit aussi les mises à jour de l'admin.

export type ElementPaquet = { type: TypeElement; source_id: string | null; contenu: Contenu; origine: Contenu | null; ordre: number }
export type Paquet = { format: 'codex-module'; version: 1; nom: string; source_type: SourceType | null; source_id: string | null; elements: ElementPaquet[] }

export const TAILLE_MAX = 10 * 1024 * 1024
const MAX_ELEMENTS = 5000

export function paquet(pm: PersoModule, elements: PersoElement[]): Paquet {
  return {
    format: 'codex-module', version: 1, nom: pm.nom, source_type: pm.source_type, source_id: pm.source_id,
    elements: elements.filter(e => !e.supprime).map(e => ({ type: e.type, source_id: e.source_id, contenu: e.contenu, origine: e.origine, ordre: e.ordre })),
  }
}

// ---------- Validation (le paquet vient de l'extérieur : fichier ou partage d'un autre étudiant) ----------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const objet = (x: unknown): x is Contenu => !!x && typeof x === 'object' && !Array.isArray(x)
const texte = (x: unknown) => typeof x === 'string'
const texteOuNul = (x: unknown) => x == null || typeof x === 'string'

function contenuValide(type: TypeElement, c: Contenu): boolean {
  if (type === 'fiche') return texte(c.question) && texte(c.reponse) && (c.tags == null || (Array.isArray(c.tags) && c.tags.every(texte)))
  if (type === 'qcm_question') return texte(c.enonce) && Array.isArray(c.options)
    && c.options.every(o => objet(o) && texte(o.t) && typeof o.c === 'boolean')
    && (c.reponses_ok == null || (Array.isArray(c.reponses_ok) && c.reponses_ok.every(texte)))
    && texteOuNul(c.explication) && texteOuNul(c.cas) && texteOuNul(c.reponse_affichee)
  if (type === 'cours') return texte(c.titre) && texteOuNul(c.description) && texteOuNul(c.fichier_url) && texteOuNul(c.fichier_nom) && texteOuNul(c.type)
  return texte(c.titre) && texteOuNul(c.url)
}

/** Vérifie un paquet inconnu ; lève une erreur lisible par l'étudiant s'il n'est pas valide. */
export function lirePaquet(x: unknown): Paquet {
  const ko = (m: string): never => { throw new Error(m) }
  if (!objet(x) || x.format !== 'codex-module') ko("Ce fichier n'est pas un module codex.")
  const p = x as Contenu
  if (p.version !== 1) ko('Version de fichier non prise en charge.')
  if (!texte(p.nom) || !(p.nom as string).trim() || (p.nom as string).length > 200) ko('Nom du module invalide.')
  if (!(p.source_type == null || ['module', 'qcm', 'mindmap'].includes(p.source_type as string))) ko('Origine invalide.')
  if (!(p.source_id == null || (texte(p.source_id) && UUID.test(p.source_id as string)))) ko('Origine invalide.')
  if (!Array.isArray(p.elements) || p.elements.length > MAX_ELEMENTS) ko(`Le module doit contenir au plus ${MAX_ELEMENTS} éléments.`)
  const elements = (p.elements as unknown[]).map((e, i): ElementPaquet => {
    const err = () => ko(`Élément ${i + 1} invalide.`)
    if (!objet(e) || !['fiche', 'qcm_question', 'cours', 'mindmap'].includes(e.type as string)) err()
    const el = e as Contenu
    if (!objet(el.contenu) || !contenuValide(el.type as TypeElement, el.contenu)) err()
    if (!(el.origine == null || (objet(el.origine) && contenuValide(el.type as TypeElement, el.origine)))) err()
    if (!(el.source_id == null || (texte(el.source_id) && UUID.test(el.source_id as string)))) err()
    if (!Number.isInteger(el.ordre ?? 0)) err()
    return { type: el.type as TypeElement, source_id: (el.source_id as string) ?? null, contenu: el.contenu as Contenu, origine: (el.origine as Contenu) ?? null, ordre: (el.ordre as number) ?? i }
  })
  return { format: 'codex-module', version: 1, nom: (p.nom as string).trim(), source_type: (p.source_type as SourceType) ?? null, source_id: (p.source_id as string) ?? null, elements }
}

/** Crée une copie dans l'espace de l'étudiant à partir d'un paquet validé. Renvoie son id. */
export async function importer(p: Paquet): Promise<string> {
  if (!navigator.onLine) throw new Error("L'import demande une connexion internet.")
  const { data: pm, error } = await supabase.from('perso_modules')
    .insert({ nom: p.nom, source_type: p.source_type, source_id: p.source_id }).select('id').single()
  if (error || !pm) throw new Error(error?.message || 'création impossible')
  for (let i = 0; i < p.elements.length; i += 500) { // par lots : un gros module dépasserait la taille d'une requête
    const { error: e } = await supabase.from('perso_elements').insert(p.elements.slice(i, i + 500).map(x => ({ ...x, perso_module_id: pm.id })))
    if (e) {
      await supabase.from('perso_modules').delete().eq('id', pm.id) // pas de copie à moitié importée
      throw new Error(e.message)
    }
  }
  return pm.id
}

/** Télécharge le paquet en fichier .codex.json. */
export function exporterFichier(p: Paquet) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(p)], { type: 'application/json' }))
  a.download = `${p.nom.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)}.codex.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ---------- Partage par lien ----------
export async function partageExistant(pmId: string): Promise<string | null> {
  const { data } = await supabase.from('partages').select('id').eq('perso_module_id', pmId).maybeSingle()
  return data?.id ?? null
}

/** Crée le lien de partage, ou remplace son contenu par la version actuelle. Renvoie l'id (jeton du lien). */
export async function partager(pmId: string, p: Paquet): Promise<string> {
  const { data, error } = await supabase.from('partages')
    .upsert({ perso_module_id: pmId, contenu: p }, { onConflict: 'perso_module_id' }).select('id').single()
  if (error || !data) throw new Error(error?.message || 'partage impossible')
  return data.id
}

export async function arreterPartage(pmId: string): Promise<void> {
  const { error } = await supabase.from('partages').delete().eq('perso_module_id', pmId)
  if (error) throw new Error(error.message)
}

/** Paquet derrière un lien de partage (null si le lien n'existe plus). */
export async function lirePartage(id: string): Promise<Paquet | null> {
  if (!UUID.test(id)) return null
  const { data, error } = await supabase.rpc('lire_partage', { p_id: id })
  if (error) throw new Error(error.message)
  return data ? lirePaquet(data) : null
}
