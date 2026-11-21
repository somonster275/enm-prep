import { supabase, toutesLesLignes } from '@/lib/supabase'
import type { PersoModule, PersoElement } from '@/lib/espace-perso'

// Hors ligne façon Anki : « Mon espace » est gardé dans le navigateur (IndexedDB).
// Les pages perso lisent cette copie locale ; chaque écriture l'applique tout de suite
// en local puis part dans une file envoyée à Supabase dès que le réseau est là.
// Conflits : la dernière écriture envoyée gagne (un seul utilisateur par copie).

export type ProgPerso = { utilisateur_id: string; fiche_id: string; niveau: number; palier: number; prochaine_revision: string; derniere_revision?: string | null }
export type Instantane = { uid: string; modules: PersoModule[]; elements: PersoElement[]; progression: ProgPerso[] }
export type Op =
  | { table: 'perso_elements' | 'perso_progression'; action: 'upsert'; ligne: Record<string, unknown> }
  | { table: 'perso_elements' | 'perso_modules' | 'perso_progression'; action: 'update' | 'delete'; filtre: Record<string, string>; champs?: Record<string, unknown> }
  | { rpc: 'incr_activite'; args: Record<string, unknown> }

// ---------- IndexedDB minimal (clé → valeur) ----------
let base: Promise<IDBDatabase> | null = null
const ouvrir = () => base ??= new Promise((ok, ko) => {
  const r = indexedDB.open('codex', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('kv')
  r.onsuccess = () => ok(r.result)
  r.onerror = () => ko(r.error)
})
const kv = async <T>(cle: string, valeur?: T | null): Promise<T | undefined> => {
  const db = await ouvrir()
  return new Promise((ok, ko) => {
    const st = db.transaction('kv', valeur === undefined ? 'readonly' : 'readwrite').objectStore('kv')
    const r = valeur === undefined ? st.get(cle) : valeur === null ? st.delete(cle) : st.put(valeur, cle)
    r.onsuccess = () => ok(valeur === undefined ? r.result : undefined)
    r.onerror = () => ko(r.error)
  })
}

// ---------- Application locale d'une écriture (pure, testée) ----------
const correspond = (l: object, f: Record<string, string>) => Object.entries(f).every(([k, v]) => (l as Record<string, unknown>)[k] === v)
const cleProg = (p: { utilisateur_id: unknown; fiche_id: unknown }) => `${p.utilisateur_id}|${p.fiche_id}`

export function appliquerLocal(s: Instantane, op: Op): Instantane {
  if ('rpc' in op) return s
  if (op.table === 'perso_modules') {
    if (op.action !== 'delete') return s
    const partis = new Set(s.modules.filter(m => correspond(m, op.filtre)).map(m => m.id))
    const elementsPartis = new Set(s.elements.filter(e => partis.has(e.perso_module_id)).map(e => e.id))
    return {
      ...s, modules: s.modules.filter(m => !partis.has(m.id)),
      elements: s.elements.filter(e => !elementsPartis.has(e.id)),
      progression: s.progression.filter(p => !elementsPartis.has(p.fiche_id)), // cascade, comme en base
    }
  }
  if (op.table === 'perso_elements') {
    if (op.action === 'upsert') {
      const l = op.ligne as PersoElement
      return { ...s, elements: s.elements.some(e => e.id === l.id) ? s.elements.map(e => e.id === l.id ? { ...e, ...l } : e) : [...s.elements, l] }
    }
    if (op.action === 'update') return { ...s, elements: s.elements.map(e => correspond(e, op.filtre) ? { ...e, ...op.champs } : e) }
    const partis = new Set(s.elements.filter(e => correspond(e, op.filtre)).map(e => e.id))
    return { ...s, elements: s.elements.filter(e => !partis.has(e.id)), progression: s.progression.filter(p => !partis.has(p.fiche_id)) }
  }
  if (op.action === 'upsert') {
    const l = op.ligne as ProgPerso
    return { ...s, progression: [...s.progression.filter(p => cleProg(p) !== cleProg(l)), l] }
  }
  if (op.action === 'delete') return { ...s, progression: s.progression.filter(p => !correspond(p, op.filtre)) }
  return s
}

// ---------- Identité ----------
// getSession est local (cookie) ; hors ligne avec un jeton expiré il peut échouer : on garde alors l'uid de la copie.
async function uidSession(): Promise<string | null> {
  try { return (await supabase.auth.getSession()).data.session?.user.id ?? null } catch { return null }
}

/** Copie locale de l'utilisateur courant (jamais celle d'un autre compte du même navigateur). */
export async function instantane(): Promise<Instantane | null> {
  const s = await kv<Instantane>('perso').catch(() => undefined)
  if (!s) return null
  const uid = await uidSession()
  return !uid || uid === s.uid ? s : null
}

// ---------- File d'envoi ----------
type OpEnFile = Op & { uid: string; oid: string }
const estReseau = (m: string) => !navigator.onLine || /fetch|network|load failed|timeout/i.test(m)
// Toutes les lectures-écritures de la file passent par ce verrou, partagé entre onglets (app installée + navigateur) :
// un ajout pendant un envoi n'est jamais perdu. Sans Web Locks (vieux navigateurs), verrou limité à l'onglet.
const verrous = new Map<string, Promise<unknown>>() // une chaîne par nom : « envoi » appelle « file », une seule chaîne s'interbloquerait
const exclusif = <T>(nom: string, fn: () => Promise<T>): Promise<T> => {
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(nom, fn) as Promise<T>
  const suite = (verrous.get(nom) ?? Promise.resolve()).then(fn)
  verrous.set(nom, suite.catch(() => {}))
  return suite
}
const modifierFile = <T>(fn: (file: OpEnFile[]) => [OpEnFile[], T] | Promise<[OpEnFile[], T]>): Promise<T> =>
  exclusif('codex-file', async () => {
    const [file, r] = await fn((await kv<OpEnFile[]>('file')) || [])
    await kv('file', file)
    return r
  })

async function executer(op: Op): Promise<{ message: string } | null> {
  try {
    if ('rpc' in op) return (await supabase.rpc(op.rpc, op.args)).error
    if (op.action === 'upsert') return (await supabase.from(op.table).upsert(op.ligne,
      op.table === 'perso_progression' ? { onConflict: 'utilisateur_id,fiche_id' } : undefined)).error
    let q = op.action === 'delete' ? supabase.from(op.table).delete() : supabase.from(op.table).update(op.champs!)
    for (const [k, v] of Object.entries(op.filtre)) q = q.eq(k, v)
    return (await q).error
  } catch (e) { return { message: String(e) } }
}

let envoi: Promise<void> | null = null
/** Envoie à Supabase, dans l'ordre, les écritures en attente du compte connecté. S'arrête à la première coupure réseau. */
export function vider(): Promise<void> {
  // Un seul envoi à la fois, tous onglets confondus : sinon une écriture partirait deux fois (activité comptée double).
  return envoi ??= exclusif('codex-envoi', async () => {
    try {
      const uid = await uidSession()
      if (!uid) return
      for (;;) {
        const op = await modifierFile(f => [f, f.find(o => o.uid === uid)])
        if (!op) return
        const erreur = await executer(op)
        if (erreur && estReseau(erreur.message)) return
        // Refus serveur (droits, ligne disparue, jour d'activité trop ancien…) : abandonnée pour ne pas bloquer la file.
        if (erreur) console.error('Écriture hors ligne abandonnée :', erreur.message)
        await modifierFile(f => [f.filter(o => o.oid !== op.oid), null])
      }
    } catch (e) { console.error('File hors ligne :', e) }
    finally { envoi = null }
  })
}

/** Met une écriture en file (sans copie locale à modifier : activité du jour). */
export async function mettreEnFile(op: Op): Promise<void> {
  const uid = await uidSession() ?? (await kv<Instantane>('perso').catch(() => undefined))?.uid
  if (!uid) return
  await modifierFile(f => [[...f, { ...op, uid, oid: crypto.randomUUID() }], null])
}

/** Écrit dans « Mon espace » : applique en local tout de suite, puis envoie dès que possible. */
export async function muter(op: Op): Promise<{ error: { message: string } | null }> {
  const uid = await uidSession()
  try {
    await modifierFile(async f => {
      const s = await instantane()
      if (s) await kv('perso', appliquerLocal(s, op))
      const u = uid ?? s?.uid
      return [u ? [...f, { ...op, uid: u, oid: crypto.randomUUID() }] : f, null]
    })
  } catch {
    return { error: await executer(op) } // stockage local indisponible (certains modes privés) : écriture directe
  }
  vider()
  return { error: null }
}

/** Envoie la file puis recharge la copie depuis Supabase. Hors ligne : renvoie la copie locale. */
// shortcut: recharge tout « Mon espace » à chaque page perso ouverte ; passer à un chargement incrémental
// (colonne updated_at) quand un étudiant dépasse quelques milliers de fiches.
export async function rafraichir(): Promise<Instantane | null> {
  if (navigator.onLine) {
    await vider()
    const uid = await uidSession()
    if (uid) {
      const [m, e, p] = await Promise.all([
        toutesLesLignes<PersoModule>((de, a) => supabase.from('perso_modules').select('*').order('created_at', { ascending: false }).order('id').range(de, a)),
        toutesLesLignes<PersoElement>((de, a) => supabase.from('perso_elements').select('*').order('ordre').order('created_at').order('id').range(de, a)),
        toutesLesLignes<ProgPerso>((de, a) => supabase.from('perso_progression').select('*').order('fiche_id').range(de, a)),
      ])
      if (!m.error && !e.error && !p.error) {
        const s: Instantane = { uid, modules: m.data, elements: e.data, progression: p.data }
        // Pas d'écrasement si une écriture locale attend encore (elle disparaîtrait de l'écran).
        const ecrit = await modifierFile(async f => {
          if (f.some(o => o.uid === uid)) return [f, false]
          await kv('perso', s)
          return [f, true]
        }).catch(() => true) // stockage local indisponible : on affiche quand même les données fraîches
        if (ecrit) return s
      }
    }
  }
  return instantane()
}

/** À la déconnexion : la copie locale ne doit pas rester visible pour le prochain compte. */
export async function oublierCopieLocale() {
  await kv('perso', null).catch(() => {})
  if ('caches' in window) await Promise.all([CACHE_PAGES, CACHE_FICHIERS].map(c => caches.delete(c)))
}

// ---------- Pages et fichiers disponibles hors ligne (Cache Storage, lu par public/sw.js) ----------
export const CACHE_PAGES = 'codex-pages-v1'
export const CACHE_STATIQUE = 'codex-statique-v1'
export const CACHE_FICHIERS = 'codex-fichiers-v1'

/** Met en cache les pages de « Mon espace » et leur JavaScript, pour les ouvrir sans réseau. */
export async function preparerPages(ids: string[]): Promise<void> {
  if (!('caches' in window) || !navigator.onLine) return
  const pages = await caches.open(CACHE_PAGES)
  const statique = await caches.open(CACHE_STATIQUE)
  const urls = ['/mon-espace', ...ids.flatMap(id => [`/mon-espace/${id}`, `/espaces/mon-espace/revision?perso=${id}`, `/qcm?perso=${id}`])]
  for (const url of urls) {
    // '/mon-espace' toujours rafraîchie ; les autres une fois (le service worker les tient à jour à chaque visite).
    if (url !== '/mon-espace' && await pages.match(url)) continue
    try {
      const r = await fetch(url, { credentials: 'same-origin' })
      if (!r.ok || r.redirected) continue
      const html = await r.clone().text()
      await pages.put(url, r)
      const scripts = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])]
      for (const s of scripts) if (!(await statique.match(s))) await statique.add(s).catch(() => {})
    } catch { return } // réseau coupé en route : on reprendra à la prochaine visite
  }
}

/** Fichier de notre stockage Supabase (déposé par le staff) : les seuls gardés et servis hors ligne (cf. public/sw.js). */
export function estFichierStockage(u: string): boolean {
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname.endsWith('.supabase.co') && x.pathname.startsWith('/storage/v1/object/public/') }
  catch { return false }
}

/** Télécharge des fichiers (cours PDF, mind maps) pour les ouvrir sans réseau. Renvoie le nombre mis en cache. */
export async function telechargerFichiers(urls: string[]): Promise<number> {
  urls = urls.filter(estFichierStockage)
  const c = await caches.open(CACHE_FICHIERS)
  let n = 0
  for (const u of urls) {
    try { if (await c.match(u) || (await c.add(u), true)) n++ } catch { /* fichier inaccessible : ignoré */ }
  }
  return n
}

export async function fichiersEnCache(urls: string[]): Promise<number> {
  if (!('caches' in window)) return 0
  const c = await caches.open(CACHE_FICHIERS)
  return (await Promise.all(urls.map(u => c.match(u)))).filter(Boolean).length
}

/** Lien vers un fichier : direct en ligne, servi par le service worker hors ligne. */
export const lienFichier = (u: string) =>
  typeof navigator !== 'undefined' && !navigator.onLine && estFichierStockage(u) ? `/fichier-hors-ligne?u=${encodeURIComponent(u)}` : u
