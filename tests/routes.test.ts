// Routes API sensibles, avec une fausse base Supabase (aucun appel réseau).
// Lancé avec --experimental-test-module-mocks (script `npm test`).
import { test, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

type Res = { data?: unknown; error?: { message: string; code?: string } | null; count?: number }
type Repondeur = (table: string, ops: string[]) => Res

// État modifié par chaque test ; les modules simulés le lisent à chaque appel.
let utilisateur: { id: string } | null = { id: 'u1' }
let admin = false
let repondre: Repondeur = () => ({})
let journal: string[] = []
let embedSimule: (t: string[]) => Promise<number[][]> = async t => t.map(() => [0])

// Chaîne Supabase factice : enregistre les méthodes appelées, résout via `repondre`.
function chaine(table: string) {
  const ops: string[] = []
  const p: unknown = new Proxy(() => {}, {
    get(_, k) {
      if (k === 'then') {
        journal.push(`${table}:${ops.join('.')}`)
        const r = { data: null, error: null, ...repondre(table, ops) }
        return (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(r).then(ok, ko)
      }
      return () => { ops.push(String(k)); return p }
    },
  })
  return p
}
const fauxAdmin = {
  from: (t: string) => chaine(t),
  rpc: (fn: string) => chaine(`rpc:${fn}`),
  auth: { admin: { deleteUser: async () => { journal.push('auth:deleteUser'); return { data: null, error: null, ...repondre('auth:deleteUser', []) } } } },
}

mock.module('@/lib/auth-serveur', { namedExports: { utilisateurCourant: async () => utilisateur, estAdmin: async () => admin } })
mock.module('@/lib/supabase', { namedExports: { getSupabaseAdmin: () => fauxAdmin } })
mock.module('@/lib/embeddings', { namedExports: { embed: (t: string[]) => embedSimule(t), toVector: (v: number[]) => `[${v}]` } })

const appel = (body: unknown) => new Request('http://test/api', { method: 'POST', body: JSON.stringify(body) }) as never
const json = async (r: Response) => ({ status: r.status, corps: await r.json() })

beforeEach(() => { utilisateur = { id: 'u1' }; admin = false; journal = []; repondre = () => ({}); embedSimule = async t => t.map(() => [0]) })

// ---------- Duel : réponse ----------
const MATCH = { id: 'm1', code: 'ABCDEF', mode: 'async', expire_at: null, deck: [{}, {}], secondes_par_question: 20, started_at: null, statut: 'en_cours' }
const duel = (o: { inscrit?: boolean; solErr?: boolean; insErr?: { message: string; code?: string } }): Repondeur => (t, ops) => {
  if (t === 'matchs') return { data: MATCH }
  if (t === 'match_joueurs' && !ops.includes('update')) return { data: o.inscrit === false ? null : { user_id: 'u1' } }
  if (t === 'match_solutions') return o.solErr ? { error: { message: 'panne' } } : { data: { solutions: [[1], [0]] } }
  if (t === 'match_reponses' && ops.includes('insert')) return { error: o.insErr ?? null }
  if (t === 'match_reponses' && ops.includes('select')) return { data: [{ juste: true, points: 100 }] }
  return {}
}

test('duel/repondre : non inscrit → 403, sans enregistrer de réponse', async () => {
  const { POST } = await import('../app/api/duel/repondre/route')
  repondre = duel({ inscrit: false })
  const r = await json(await POST(appel({ code: 'abcdef', qIndex: 0, choix: [1] })))
  assert.equal(r.status, 403)
  assert.ok(!journal.some(l => l.startsWith('match_reponses')))
})

test('duel/repondre : bonne réponse en asynchrone → 100 points et correction', async () => {
  const { POST } = await import('../app/api/duel/repondre/route')
  repondre = duel({})
  const r = await json(await POST(appel({ code: 'ABCDEF', qIndex: 0, choix: [1] })))
  assert.equal(r.status, 200)
  assert.deepEqual([r.corps.juste, r.corps.points, r.corps.correct], [true, 100, [1]])
})

test('duel/repondre : solutions illisibles → 500 (pas de réponse verrouillée fausse)', async () => {
  const { POST } = await import('../app/api/duel/repondre/route')
  repondre = duel({ solErr: true })
  assert.equal((await POST(appel({ code: 'ABCDEF', qIndex: 0, choix: [1] }))).status, 500)
  assert.ok(!journal.some(l => l.startsWith('match_reponses')))
})

test('duel/repondre : doublon (23505) = déjà répondu ; autre erreur = 500', async () => {
  const { POST } = await import('../app/api/duel/repondre/route')
  repondre = duel({ insErr: { message: 'dup', code: '23505' } })
  assert.equal((await json(await POST(appel({ code: 'ABCDEF', qIndex: 0, choix: [1] })))).corps.deja, true)
  repondre = duel({ insErr: { message: 'panne' } })
  assert.equal((await POST(appel({ code: 'ABCDEF', qIndex: 0, choix: [1] }))).status, 500)
})

// ---------- Duel : lancement ----------
test('duel/lancer : seul l’hôte d’un duel en attente peut lancer', async () => {
  const { POST } = await import('../app/api/duel/lancer/route')
  repondre = () => ({ data: [] }) // aucune ligne mise à jour (pas l'hôte, ou déjà lancé)
  assert.equal((await POST(appel({ code: 'ABCDEF' }))).status, 409)
  repondre = () => ({ data: [{ id: 'm1' }] })
  assert.equal((await POST(appel({ code: 'ABCDEF' }))).status, 200)
  assert.match(journal.at(-1)!, /eq\.eq\.eq/) // filtre code + hôte + statut
  utilisateur = null
  assert.equal((await POST(appel({ code: 'ABCDEF' }))).status, 401)
})

// ---------- Suppression de compte (RGPD) ----------
test('compte/supprimer : table absente tolérée, compte supprimé avant le profil', async () => {
  const { POST } = await import('../app/api/compte/supprimer/route')
  repondre = t => t === 'notes' ? { error: { message: 'absente', code: '42P01' } } : t === 'cours_documents' ? { data: [] } : {}
  assert.equal((await POST()).status, 200)
  const iAuth = journal.indexOf('auth:deleteUser')
  const iProfil = journal.findIndex(l => l.startsWith('profils:delete'))
  assert.ok(iAuth >= 0 && iProfil > iAuth)
})

test('compte/supprimer : erreur de données → 500 avant toute suppression du compte', async () => {
  const { POST } = await import('../app/api/compte/supprimer/route')
  repondre = t => t === 'progression' ? { error: { message: 'panne' } } : {}
  assert.equal((await POST()).status, 500)
  assert.ok(!journal.includes('auth:deleteUser'))
})

test('compte/supprimer : échec de deleteUser → profil conservé', async () => {
  const { POST } = await import('../app/api/compte/supprimer/route')
  repondre = t => t === 'auth:deleteUser' ? { error: { message: 'panne auth' } } : t === 'cours_documents' ? { data: [] } : {}
  assert.equal((await POST()).status, 500)
  assert.ok(!journal.some(l => l.startsWith('profils:delete')))
})

// ---------- Administration ----------
test('admin/supprimer-utilisateur : impossible de supprimer un autre admin', async () => {
  const { POST } = await import('../app/api/admin/supprimer-utilisateur/route')
  admin = true
  repondre = () => ({ data: { role: 'admin' } })
  assert.equal((await POST(appel({ id: 'u2' }))).status, 403)
  assert.ok(!journal.includes('auth:deleteUser'))
  admin = false
  assert.equal((await POST(appel({ id: 'u2' }))).status, 403) // non-admin
})

test('admin/utilisateurs : impossible de changer le rôle d’un autre admin', async () => {
  const { POST } = await import('../app/api/admin/utilisateurs/route')
  admin = true
  repondre = (t, ops) => ops.includes('update') ? {} : { data: { role: 'admin' } }
  assert.equal((await POST(appel({ id: 'u2', role: 'lecteur' }))).status, 403)
  assert.ok(!journal.some(l => l.includes('update')))
  repondre = (t, ops) => ops.includes('update') ? {} : { data: { role: 'editeur' } }
  assert.equal((await POST(appel({ id: 'u2', role: 'lecteur' }))).status, 200)
})

// ---------- Indexation base ENM ----------
test('cours/indexer : lot embeddé puis restants ; limite Voyage → 429 « attendre »', async () => {
  const { POST } = await import('../app/api/cours/indexer/route')
  admin = true
  repondre = (t, ops) => ops.includes('limit') ? { data: [{ id: 'c1', contenu: 'a' }, { id: 'c2', contenu: 'b' }] } : ops.includes('update') ? {} : { count: 5 }
  const ok = await json(await POST(appel({ id: 'd1' })))
  assert.deepEqual([ok.status, ok.corps.restants], [200, 5])
  assert.equal(journal.filter(l => l.includes('update')).length, 2)

  embedSimule = async () => { throw new Error('Voyage AI : limite de taux dépassée') }
  const err = console.error; console.error = () => {}
  try {
    const r = await json(await POST(appel({ id: 'd1' })))
    assert.deepEqual([r.status, r.corps.attendre], [429, true])
  } finally { console.error = err }

  admin = false
  assert.equal((await POST(appel({ id: 'd1' }))).status, 403)
})
