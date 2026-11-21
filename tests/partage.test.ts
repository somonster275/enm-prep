// Partage / export : un paquet exporté se relit à l'identique ; un fichier invalide est refusé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paquet, lirePaquet } from '../lib/partage'

const U = '11111111-2222-3333-4444-555555555555'
const pm = { id: 'pm', nom: 'Droit pénal', source_type: 'module', source_id: U, created_at: '' } as const
const el = (type: string, contenu: object, extra = {}) =>
  ({ id: 'x', perso_module_id: 'pm', type, source_id: U, contenu, origine: contenu, supprime: false, ordre: 1, created_at: '', ...extra }) as never

test('export puis import : identique, éléments supprimés exclus', () => {
  const p = paquet(pm as never, [
    el('fiche', { question: 'Q', reponse: 'R', tags: ['a'] }),
    el('qcm_question', { enonce: 'E', options: [{ t: 'a', c: true }], explication: null, cas: null, reponses_ok: null, reponse_affichee: null }),
    el('cours', { titre: 'T', description: null, fichier_url: 'https://x/y.pdf', fichier_nom: null, type: 'pdf' }),
    el('mindmap', { titre: 'M', url: null }, { source_id: null, origine: null }),
    el('fiche', { question: 'gone', reponse: '' }, { supprime: true }),
  ])
  const relu = lirePaquet(JSON.parse(JSON.stringify(p)))
  assert.deepEqual(relu, p)
  assert.equal(relu.elements.length, 4)
})

test('fichiers refusés', () => {
  const ok = { format: 'codex-module', version: 1, nom: 'N', source_type: null, source_id: null, elements: [] }
  const refuse = (x: unknown) => assert.throws(() => lirePaquet(x))
  lirePaquet(ok)
  refuse(null)
  refuse({ ...ok, format: 'autre' })
  refuse({ ...ok, version: 2 })
  refuse({ ...ok, nom: '   ' })
  refuse({ ...ok, source_type: 'espace' })
  refuse({ ...ok, source_id: "'; drop table x" })
  refuse({ ...ok, elements: [{ type: 'script', contenu: {} }] })
  refuse({ ...ok, elements: [{ type: 'fiche', contenu: { question: 1, reponse: 'r' } }] })
  refuse({ ...ok, elements: [{ type: 'qcm_question', contenu: { enonce: 'e', options: 'pas un tableau' } }] })
  refuse({ ...ok, elements: Array(5001).fill({ type: 'mindmap', contenu: { titre: 't' } }) })
})
