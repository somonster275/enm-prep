// File d'envoi hors ligne (lib/hors-ligne.ts) avec une IndexedDB simulée et un faux Supabase :
// rien ne part hors ligne, tout part dans l'ordre au retour du réseau, une seule fois.
import 'fake-indexeddb/auto'
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

let reseau = true
const appels: string[] = []
Object.defineProperty(globalThis.navigator, 'onLine', { get: () => reseau, configurable: true })
const rep = (desc: string, data: unknown = []) => {
  if (!reseau) return { data: null, error: { message: 'TypeError: fetch failed' } }
  if (desc) appels.push(desc)
  return { data, error: null }
}
const chaine = (desc: string, data?: unknown) => {
  const c: Record<string, unknown> = {}
  for (const m of ['eq', 'order', 'range', 'select']) c[m] = (...a: unknown[]) => { if (m === 'eq') desc += ` ${a.join('=')}`; return c }
  c.then = (ok: (v: unknown) => void) => ok(rep(desc, data))
  return c
}
const base: Record<string, unknown[]> = { perso_modules: [{ id: 'm1', nom: 'M' }], perso_elements: [], perso_progression: [] }
mock.module('@/lib/supabase', { namedExports: {
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }) },
    rpc: async (n: string, a: unknown) => rep(`rpc ${n} ${JSON.stringify(a)}`, null),
    from: (t: string) => ({
      select: () => chaine('', base[t]),
      upsert: (l: { id?: string; fiche_id?: string }) => chaine(`upsert ${t} ${l.id ?? l.fiche_id}`),
      update: (ch: object) => chaine(`update ${t} ${JSON.stringify(ch)}`),
      delete: () => chaine(`delete ${t}`),
    }),
  },
  toutesLesLignes: async (page: (de: number, a: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>) => {
    const { data, error } = await page(0, 999); return { data: data || [], error }
  },
} })

test('hors ligne : écrit en local, envoie au retour du réseau, dans l\'ordre et une seule fois', async () => {
  const hl = await import('../lib/hors-ligne')
  assert.equal((await hl.rafraichir())?.modules.length, 1)        // en ligne : copie locale créée

  reseau = false
  const el = { id: 'e1', perso_module_id: 'm1', type: 'fiche', source_id: null, contenu: { question: 'Q' }, origine: null, supprime: false, ordre: 1, created_at: '' }
  await Promise.all([                                              // écritures simultanées : aucune perdue
    hl.muter({ table: 'perso_elements', action: 'upsert', ligne: el }),
    hl.muter({ table: 'perso_progression', action: 'upsert', ligne: { utilisateur_id: 'u', fiche_id: 'e1', niveau: 2, palier: 1, prochaine_revision: 'x' } }),
    hl.mettreEnFile({ rpc: 'incr_activite', args: { p_jour: 'j', p_delta: 1 } }),
  ])
  await hl.vider()
  const local = await hl.rafraichir()                              // hors ligne : copie locale à jour
  assert.deepEqual([local?.elements.length, local?.progression.length], [1, 1])
  assert.equal(appels.length, 0)

  reseau = true
  await Promise.all([hl.vider(), hl.vider()])                      // deux envois concurrents : un seul passe
  assert.deepEqual(appels, ['upsert perso_elements e1', 'upsert perso_progression e1', 'rpc incr_activite {"p_jour":"j","p_delta":1}'])
  await hl.vider()
  assert.equal(appels.length, 3)                                   // file vide : rien n'est renvoyé

  await hl.oublierCopieLocale().catch(() => {})                    // pas de Cache Storage sous Node : seule la copie compte
  assert.equal(await hl.instantane(), null)
})
