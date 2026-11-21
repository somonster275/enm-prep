// Hors ligne : les écritures appliquées sur la copie locale donnent le même résultat qu'en base.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appliquerLocal, type Instantane } from '../lib/hors-ligne'

const el = (id: string, pm: string) => ({ id, perso_module_id: pm, type: 'fiche', source_id: null, contenu: { question: id }, origine: null, supprime: false, ordre: 0, created_at: '' }) as never
const prog = (fiche_id: string, niveau = 1) => ({ utilisateur_id: 'u', fiche_id, niveau, palier: 0, prochaine_revision: '' })
const base = (): Instantane => ({
  uid: 'u',
  modules: [{ id: 'm1' }, { id: 'm2' }] as never,
  elements: [el('a', 'm1'), el('b', 'm1'), el('c', 'm2')],
  progression: [prog('a'), prog('c')],
})

test('élément : ajout, modification, suppression (avec sa progression)', () => {
  let s = appliquerLocal(base(), { table: 'perso_elements', action: 'upsert', ligne: el('d', 'm2') })
  assert.deepEqual(s.elements.map(e => e.id), ['a', 'b', 'c', 'd'])
  s = appliquerLocal(s, { table: 'perso_elements', action: 'update', filtre: { id: 'b' }, champs: { supprime: true } })
  assert.equal(s.elements.find(e => e.id === 'b')!.supprime, true)
  s = appliquerLocal(s, { table: 'perso_elements', action: 'delete', filtre: { id: 'a' } })
  assert.deepEqual(s.elements.map(e => e.id), ['b', 'c', 'd'])
  assert.deepEqual(s.progression.map(p => p.fiche_id), ['c'])
})

test('module supprimé : ses éléments et leur progression partent en cascade', () => {
  const s = appliquerLocal(base(), { table: 'perso_modules', action: 'delete', filtre: { id: 'm1' } })
  assert.deepEqual(s.modules.map(m => m.id), ['m2'])
  assert.deepEqual(s.elements.map(e => e.id), ['c'])
  assert.deepEqual(s.progression.map(p => p.fiche_id), ['c'])
})

test('progression : upsert remplace la ligne de la même fiche, delete la retire', () => {
  let s = appliquerLocal(base(), { table: 'perso_progression', action: 'upsert', ligne: prog('a', 3) })
  assert.equal(s.progression.filter(p => p.fiche_id === 'a').length, 1)
  assert.equal(s.progression.find(p => p.fiche_id === 'a')!.niveau, 3)
  s = appliquerLocal(s, { table: 'perso_progression', action: 'delete', filtre: { utilisateur_id: 'u', fiche_id: 'a' } })
  assert.deepEqual(s.progression.map(p => p.fiche_id), ['c'])
  assert.equal(appliquerLocal(s, { rpc: 'incr_activite', args: {} }), s)
})
