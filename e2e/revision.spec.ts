import { test, expect, type Page } from '@playwright/test'

const compteur = async (page: Page) => {
  const m = (await page.locator('main').innerText()).match(/(\d+) sur (\d+)/)
  expect(m, 'compteur « x sur y » affiché').not.toBeNull()
  return [Number(m![1]), Number(m![2])]
}

test('noter une carte, annuler, puis la note est conservée après rechargement', async ({ page }) => {
  await page.goto('/espaces/anglais/revision')
  await page.waitForLoadState('networkidle')
  test.skip(!/\d+ sur \d+/.test(await page.locator('main').innerText()), 'plus de carte à réviser aujourd’hui pour le compte de test')
  const [, totalAvant] = await compteur(page)

  await page.getByRole('button', { name: 'Voir la réponse', exact: true }).click()
  await page.getByRole('button', { name: /Facile/ }).click()
  await expect(page.locator('main')).toContainText(`2 sur ${totalAvant}`)

  await page.keyboard.press('z') // annuler
  await expect(page.locator('main')).toContainText(`1 sur ${totalAvant}`)

  await page.keyboard.press('4') // la carte revient retournée : on la renote au clavier
  await expect(page.locator('main')).toContainText(`2 sur ${totalAvant}`)
  await expect(page.getByText('Note non enregistrée')).toHaveCount(0)

  await page.reload()
  await expect(page.locator('main')).toContainText(/\d+ sur \d+/, { timeout: 30_000 })
  const [, totalApres] = await compteur(page)
  expect(totalApres, 'la carte notée « Facile » ne revient pas tout de suite').toBeLessThan(totalAvant)
})

test('une matière avec beaucoup de fiches se charge (culture générale)', async ({ page }) => {
  await page.goto('/espaces/culture-generale/revision')
  await expect(page.locator('main')).toContainText(/\d+ sur \d+|Aucune fiche/, { timeout: 30_000 })
  await expect(page.getByText('Impossible de charger ta progression')).toHaveCount(0)
})
