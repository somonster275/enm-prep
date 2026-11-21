import { test as setup, expect } from '@playwright/test'

setup('connexion du compte de test', async ({ page }) => {
  const email = process.env.E2E_EMAIL, password = process.env.E2E_PASSWORD
  await page.goto('/login')
  await page.fill('input[type=email]', email!)
  await page.fill('input[type=password]', password!)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 })
  await page.context().storageState({ path: 'e2e/.auth/session.json' })
})
