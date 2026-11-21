import { test, expect } from '@playwright/test'

test('faire un QCM jusqu’au bout', async ({ page }) => {
  await page.goto('/qcm')
  await page.getByRole('button').filter({ hasText: 'Réponse libre' }).first().click()
  const champ = page.locator('main input[placeholder="Tape ta réponse…"]:not([disabled])')
  await expect(champ.first()).toBeVisible({ timeout: 30_000 })
  // QCM à réponse libre : on répond et valide chaque question (Entrée).
  for (let i = 0; i < 100 && await champ.count() > 0; i++) {
    await champ.first().fill('réponse de test')
    await champ.first().press('Enter')
  }
  await expect(page.getByRole('button', { name: 'Recommencer' })).toBeVisible()
  await expect(page.getByText('Réponse :').first()).toBeVisible() // la correction s'affiche
})
