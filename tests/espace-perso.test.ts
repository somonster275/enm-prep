// Mon espace : comparaison copie perso / officiel (mises à jour « option 3b »).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculerNouveautes, egal, type PersoElement } from '../lib/espace-perso'

const el = (id: string, source_id: string | null, contenu: object, origine: object | null, supprime = false): PersoElement =>
  ({ id, perso_module_id: 'pm', type: 'fiche', source_id, contenu: contenu as never, origine: origine as never, supprime, ordre: 0, created_at: '' })
const off = (source_id: string, contenu: object) => ({ type: 'fiche' as const, source_id, contenu: contenu as never, ordre: 0 })

test('égalité indépendante de l\'ordre des clés et de null/undefined', () => {
  assert.ok(egal({ a: 1, b: [1, { x: 2, y: 3 }] }, { b: [1, { y: 3, x: 2 }], a: 1 }))
  assert.ok(egal({ a: null }, { a: undefined }))
  assert.ok(!egal({ a: 1 }, { a: 2 }))
})

test('nouveautés : ajouts, mises à jour, modifiés conservés, retirés, supprimés ignorés', () => {
  const v1 = { question: 'Q', reponse: 'R1' }
  const v2 = { question: 'Q', reponse: 'R2' }
  const elements = [
    el('a', 'sa', v1, v1),                         // non modifié, l'officiel change → mise à jour
    el('b', 'sb', { question: 'Q', reponse: 'à moi' }, v1), // modifié, l'officiel change → conservé
    el('c', 'sc', v1, v1),                         // retiré de l'officiel → signalé
    el('d', 'sd', v1, v1, true),                   // supprimé par l'étudiant → jamais reproposé
    el('e', null, v1, null),                       // ajouté par l'étudiant → ignoré
    el('f', 'sf', v1, v1),                         // inchangé
  ]
  const n = calculerNouveautes(elements, [off('sa', v2), off('sb', v2), off('sd', v2), off('sf', v1), off('sn', v1)])
  assert.deepEqual(n.ajouts.map(x => x.source_id), ['sn'])
  assert.deepEqual(n.majs, [{ id: 'a', contenu: v2 }])
  assert.deepEqual(n.conserves, [{ id: 'b', contenu: v2 }])
  assert.deepEqual(n.retires, ['c'])
})
