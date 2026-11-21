import { supabase, toutesLesLignes } from '@/lib/supabase'

// « Mon espace » : copies personnelles des contenus officiels (migration 0048).

export type SourceType = 'module' | 'qcm' | 'mindmap'
export type TypeElement = 'fiche' | 'qcm_question' | 'cours' | 'mindmap'
export type Contenu = Record<string, unknown>

export type PersoModule = { id: string; nom: string; source_type: SourceType | null; source_id: string | null; created_at: string }
export type PersoElement = {
  id: string; perso_module_id: string; type: TypeElement; source_id: string | null
  contenu: Contenu; origine: Contenu | null; supprime: boolean; ordre: number; created_at: string
}
export type ElementOfficiel = { type: TypeElement; source_id: string; contenu: Contenu; ordre: number }

// Tous les IDs de modules descendants d'un module (lui inclus). UNE seule requête :
// on charge la carte parent→enfants puis on descend l'arbre en mémoire (évite le N+1).
export async function getAllModuleIds(rootId: string): Promise<string[]> {
  const { data } = await supabase.from('modules').select('id, parent_id').is('deleted_at', null)
  const enfantsDe = new Map<string, string[]>()
  for (const m of (data || []) as { id: string; parent_id: string | null }[]) {
    if (m.parent_id) { const l = enfantsDe.get(m.parent_id) || []; l.push(m.id); enfantsDe.set(m.parent_id, l) }
  }
  const ids: string[] = []
  const pile = [rootId]
  while (pile.length) {
    const cur = pile.pop()!
    ids.push(cur)
    for (const c of enfantsDe.get(cur) || []) pile.push(c)
  }
  return ids
}

/** Contenu officiel actuel d'une source : nom + éléments (même forme que perso_elements.contenu). */
export async function contenuOfficiel(type: SourceType, id: string): Promise<{ nom: string; elements: ElementOfficiel[] } | null> {
  const el = (t: TypeElement) => (source_id: string, contenu: Contenu, ordre: number): ElementOfficiel => ({ type: t, source_id, contenu, ordre })

  if (type === 'module') {
    const { data: mod } = await supabase.from('modules').select('nom').eq('id', id).maybeSingle()
    if (!mod) return null
    const ids = await getAllModuleIds(id) // un module emporte ses sous-modules
    const [{ data: fiches, error: e1 }, { data: cours, error: e2 }] = await Promise.all([
      toutesLesLignes<{ id: string; question: string; reponse: string; tags: string[] | null }>((de, a) =>
        supabase.from('fiches').select('id, question, reponse, tags').in('module_id', ids)
          .is('deleted_at', null).eq('suspendu', false).order('created_at').order('id').range(de, a)),
      supabase.from('cours').select('id, titre, description, fichier_url, fichier_nom, type').in('module_id', ids).order('created_at'),
    ])
    if (e1 || e2) return null
    return {
      nom: mod.nom,
      elements: [
        ...(fiches || []).map((f, i) => el('fiche')(f.id, { question: f.question, reponse: f.reponse, tags: f.tags ?? [] }, i)),
        ...(cours || []).map((c, i) => el('cours')(c.id, {
          titre: c.titre, description: c.description ?? null, fichier_url: c.fichier_url, fichier_nom: c.fichier_nom ?? null, type: c.type ?? null,
        }, i)),
      ],
    }
  }

  if (type === 'qcm') {
    const { data: qcm } = await supabase.from('qcm').select('titre').eq('id', id).maybeSingle()
    if (!qcm) return null
    const { data: qs, error } = await supabase.from('qcm_questions').select('*').eq('qcm_id', id).order('ordre')
    if (error) return null
    return {
      nom: qcm.titre,
      elements: (qs || []).map((q, i) => el('qcm_question')(q.id, {
        enonce: q.enonce, options: q.options ?? [], explication: q.explication ?? null,
        cas: q.cas ?? null, reponses_ok: q.reponses_ok ?? null, reponse_affichee: q.reponse_affichee ?? null,
      }, i)),
    }
  }

  const { data: mm } = await supabase.from('mindmaps').select('id, titre, url').eq('id', id).is('deleted_at', null).maybeSingle()
  if (!mm) return null
  return { nom: mm.titre, elements: [el('mindmap')(mm.id, { titre: mm.titre, url: mm.url ?? null }, 0)] }
}

/** Copie perso existante d'une source (pour ne pas la dupliquer). */
export async function copieExistante(type: SourceType, id: string): Promise<string | null> {
  const { data } = await supabase.from('perso_modules').select('id').eq('source_type', type).eq('source_id', id).limit(1)
  return data?.[0]?.id ?? null
}

/** Télécharge une source dans l'espace de l'étudiant. Renvoie l'id de la copie (existante ou nouvelle). */
export async function telecharger(type: SourceType, id: string): Promise<string> {
  const existante = await copieExistante(type, id)
  if (existante) return existante
  const off = await contenuOfficiel(type, id)
  if (!off) throw new Error('contenu introuvable')
  const { data: pm, error } = await supabase.from('perso_modules')
    .insert({ nom: off.nom, source_type: type, source_id: id }).select('id').single()
  if (error || !pm) throw new Error(error?.message || 'création impossible')
  if (off.elements.length) {
    const { error: e } = await supabase.from('perso_elements').insert(
      off.elements.map(x => ({ ...x, perso_module_id: pm.id, origine: x.contenu })))
    if (e) {
      await supabase.from('perso_modules').delete().eq('id', pm.id) // pas de copie à moitié vide
      throw new Error(e.message)
    }
  }
  return pm.id
}

// Égalité de contenus indépendante de l'ordre des clés (jsonb ne le conserve pas).
const stable = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(stable)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable((v as Contenu)[k])]))
  : v ?? null
export const egal = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))

/** L'étudiant a-t-il modifié cet élément par rapport à l'officiel ? */
export const estModifie = (e: PersoElement) => !!e.source_id && !egal(e.contenu, e.origine)

export type Nouveautes = {
  ajouts: ElementOfficiel[]                                 // nouveaux éléments officiels
  majs: { id: string; contenu: Contenu }[]                  // éléments non modifiés à remplacer
  conserves: { id: string; contenu: Contenu }[]             // éléments modifiés par l'étudiant : seule l'origine avance
  retires: string[]                                         // éléments supprimés de l'original (signalés, jamais effacés)
}

/** Compare la copie à l'officiel (pur, testé). */
export function calculerNouveautes(elements: PersoElement[], officiels: ElementOfficiel[]): Nouveautes {
  const parSource = new Map(officiels.map(o => [o.source_id, o]))
  const dejaVus = new Set(elements.map(e => e.source_id).filter(Boolean))
  const n: Nouveautes = { ajouts: officiels.filter(o => !dejaVus.has(o.source_id)), majs: [], conserves: [], retires: [] }
  for (const e of elements) {
    if (!e.source_id || e.supprime) continue
    const o = parSource.get(e.source_id)
    if (!o) { n.retires.push(e.id); continue }
    if (egal(o.contenu, e.origine)) continue
    ;(estModifie(e) ? n.conserves : n.majs).push({ id: e.id, contenu: o.contenu })
  }
  return n
}

/** Applique les nouveautés : ajoute, met à jour les éléments non modifiés, garde les modifiés. */
export async function appliquerNouveautes(pmId: string, n: Nouveautes, ordreMax: number): Promise<string | null> {
  if (n.ajouts.length) {
    const { error } = await supabase.from('perso_elements').insert(
      n.ajouts.map((x, i) => ({ ...x, ordre: ordreMax + 1 + i, perso_module_id: pmId, origine: x.contenu })))
    if (error) return error.message
  }
  for (const m of n.majs) {
    const { error } = await supabase.from('perso_elements').update({ contenu: m.contenu, origine: m.contenu }).eq('id', m.id)
    if (error) return error.message
  }
  for (const c of n.conserves) {
    const { error } = await supabase.from('perso_elements').update({ origine: c.contenu }).eq('id', c.id)
    if (error) return error.message
  }
  return null
}
