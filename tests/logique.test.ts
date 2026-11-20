// Logique pure : QCM, duels, tags, progression, e-mails, limite de débit, écritures client.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTexte, parseQcm, reponseCorrecte, normaliserReponse } from '../lib/qcm-parse'
import { pointsReponse, reponseJuste, genererCode } from '../lib/match'
import { normaliserTag, parseTags, nettoyerTags } from '../lib/tags'
import { calculerProgression } from '../lib/progression'
import { escapeHtml } from '../lib/email'
import { tropDeRequetes } from '../lib/limite'
import { melange } from '../lib/aleatoire'
import { ecrire } from '../lib/supabase'

test('QCM texte : énoncé, options, bonnes réponses, explication', () => {
  const q = parseTexte(`Q: Qui statue sur la détention provisoire ?
- Le procureur
- Le JLD *
- [x] Le juge des libertés
> Article 137-1 CPP

Q: Question sans assez d'options
- Seule`)
  assert.equal(q.length, 1) // la question à une seule option est écartée
  assert.equal(q[0].enonce, 'Qui statue sur la détention provisoire ?')
  assert.deepEqual(q[0].options.map(o => o.c), [false, true, true])
  assert.equal(q[0].options[1].t, 'Le JLD')
  assert.equal(q[0].explication, 'Article 137-1 CPP')
})

test('QCM HTML : repli sur le format texte, scripts ignorés', () => {
  const q = parseQcm('<div><script>alert(1)</script><p>Q: Capitale ?</p><p>- Paris *</p><p>- Lyon</p></div>')
  assert.equal(q.length, 1)
  assert.equal(q[0].options.find(o => o.c)?.t, 'Paris')
})

test('réponse libre : accents, casse, ponctuation, tolérance', () => {
  assert.equal(normaliserReponse('  Détention   Provisoire ! '), 'detention provisoire')
  assert.equal(reponseCorrecte('la detention provisoire', ['Détention provisoire']), true)
  assert.equal(reponseCorrecte('', ['x']), false)
  assert.equal(reponseCorrecte('ab', ['ab c']), false)
  assert.equal(reponseCorrecte('un', ['un']), true) // égalité stricte, même courte
})

test('duel : points, réponse exacte, code de salon', () => {
  assert.equal(pointsReponse(false, 10, 20), 0)
  assert.equal(pointsReponse(true, 20, 20), 150) // 100 + bonus vitesse complet
  assert.equal(pointsReponse(true, 0, 20), 100)
  assert.equal(pointsReponse(true, 99, 20), 150) // ratio plafonné
  assert.equal(pointsReponse(true, 5, 0), 100)   // durée nulle : pas de division par zéro
  const q = { options: [{ t: 'a', c: true }, { t: 'b', c: false }, { t: 'c', c: true }] } as never
  assert.equal(reponseJuste(q, new Set([0, 2])), true)
  assert.equal(reponseJuste(q, new Set([0])), false)      // incomplète
  assert.equal(reponseJuste(q, new Set([0, 1, 2])), false) // en trop
  assert.match(genererCode(), /^[A-HJ-NP-Z2-9]{6}$/)      // ni O, 0, I, 1
})

test('tags : slug sans accents, dédoublonnés', () => {
  assert.equal(normaliserTag('#Droit Pénal'), 'droit-penal')
  assert.deepEqual(parseTags('#a #b, a  c'), ['a', 'b', 'c'])
  assert.deepEqual(nettoyerTags('pas un tableau'), [])
  assert.deepEqual(nettoyerTags(['X', 'x', '', '#Y']), ['x', 'y'])
})

test('progression : pondération et cas vides', () => {
  const vide = calculerProgression({ progressions: [], modulesTotal: 0, modulesAbordes: 0, activite: {} })
  assert.deepEqual(vide, { global: 0, maitrise: 0, couverture: 0, regularite: 0 })
  const p = calculerProgression({ progressions: [{ palier: 99 }], modulesTotal: 4, modulesAbordes: 2, activite: {} })
  assert.equal(p.maitrise, 100) // palier plafonné
  assert.equal(p.couverture, 50)
  assert.equal(p.global, Math.round(0.5 * 100 + 0.3 * 50))
})

test('e-mail : le HTML saisi est neutralisé', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#039;b&#039;)&quot;&gt;&amp;')
})

test('limite de débit : par clé et par IP', () => {
  const req = (ip: string) => ({ headers: { get: () => ip } }) as never
  const cle = 'test-' + Math.random()
  assert.equal(tropDeRequetes(req('1.1.1.1'), cle, 2, 60_000), false)
  assert.equal(tropDeRequetes(req('1.1.1.1'), cle, 2, 60_000), false)
  assert.equal(tropDeRequetes(req('1.1.1.1'), cle, 2, 60_000), true)
  assert.equal(tropDeRequetes(req('2.2.2.2'), cle, 2, 60_000), false) // autre IP non pénalisée
})

test('mélange : mêmes éléments, tableau source intact', () => {
  const src = [1, 2, 3, 4, 5]
  const m = melange(src)
  assert.deepEqual([...m].sort(), src)
  assert.deepEqual(src, [1, 2, 3, 4, 5])
})

test('ecrire : erreur ou refus RLS (0 ligne) = échec', async () => {
  const r = (data: unknown[] | null, error: { message: string } | null = null) => Promise.resolve({ data, error })
  const err = console.error; console.error = () => {}
  try {
    assert.equal(await ecrire(r([{ id: 1 }])), true)
    assert.equal(await ecrire(r([])), false)                       // refus RLS silencieux
    assert.equal(await ecrire(r(null, { message: 'x' })), false)
    assert.equal(await ecrire(r([]), { vide: true }), true)        // purge sans ligne : normal
    assert.equal(await ecrire(r(null, { message: 'x' }), { vide: true }), false)
  } finally { console.error = err }
})
