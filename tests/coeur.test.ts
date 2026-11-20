// Tests du cœur de l'appli : `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { intervalleMinutes, palierApres, PALIER_MAX } from '../lib/spaced-repetition'
import { calculerStreak, ymd } from '../lib/streaks'
import { urlPublique, lienSur } from '../lib/url-publique'
import { toutesLesLignes } from '../lib/supabase'

const J = 1440
const jour = (decalage: number) => { const d = new Date(); d.setDate(d.getDate() - decalage); return ymd(d) }

test('répétition espacée : paliers et intervalles', () => {
  assert.equal(intervalleMinutes(0, 4), 1)          // « À revoir » : toujours 1 min
  assert.equal(palierApres(0, 4), 0)                // … et remet le palier à 0
  assert.equal(intervalleMinutes(2, 0), 1 * J)      // « Correct » à la 1re vue : 1 jour
  assert.equal(intervalleMinutes(3, 0), 5 * J)      // « Facile » à la 1re vue : 5 jours
  assert.equal(palierApres(2, 0), 1)
  assert.equal(palierApres(3, PALIER_MAX), PALIER_MAX) // plafonné
  assert.equal(intervalleMinutes(3, 99), 365 * J)   // au-delà du tableau : dernière valeur
})

test('série : jours consécutifs, tolérance de la veille, pauses', () => {
  assert.equal(calculerStreak({}), 0)
  assert.equal(calculerStreak({ [jour(0)]: 3, [jour(1)]: 5 }), 2)
  assert.equal(calculerStreak({ [jour(1)]: 5, [jour(2)]: 1 }), 2)      // rien aujourd'hui : on compte depuis hier
  assert.equal(calculerStreak({ [jour(2)]: 5 }), 0)                     // deux jours sans rien : série perdue
  assert.equal(calculerStreak({ [jour(0)]: 1, [jour(1)]: 0, [jour(2)]: 1 }), 1) // un trou casse la série
  const pause = [{ debut: jour(3), fin: jour(1) }]
  assert.equal(calculerStreak({ [jour(0)]: 1, [jour(4)]: 1, [jour(5)]: 1 }, pause), 3) // la pause est sautée
})

test('adresses de flux : seulement le web public', () => {
  assert.ok(urlPublique('https://www.dalloz-actualite.fr/rss'))
  for (const u of ['javascript:alert(1)', 'file:///etc/passwd', 'http://localhost:3000', 'http://127.0.0.1/',
    'http://169.254.169.254/latest', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://172.20.0.1/',
    'http://2130706433/', 'http://[::1]/', 'http://user:mdp@exemple.fr/', 'pas une url']) {
    assert.equal(urlPublique(u), null, u)
  }
  assert.equal(lienSur('javascript:alert(1)'), null)
  assert.equal(lienSur('https://exemple.fr'), 'https://exemple.fr')
})

test('pagination Supabase : récupère tout au-delà de 1 000 lignes', async () => {
  for (const n of [0, 999, 1000, 1536, 2001]) {
    const tout = Array.from({ length: n }, (_, i) => i)
    const { data } = await toutesLesLignes(async (de, a) => ({ data: tout.slice(de, a + 1), error: null }))
    assert.deepEqual(data, tout)
  }
})
