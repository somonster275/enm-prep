import { test, expect } from '@playwright/test'

for (const [path, titre] of [['/', 'codex'], ['/login', 'Connexion — codex'], ['/methode', 'Méthode — codex'], ['/contact', 'Contact — codex']]) {
  test(`page publique ${path}`, async ({ page }) => {
    const erreurs: string[] = []
    page.on('pageerror', e => erreurs.push(e.message))
    await page.goto(path)
    await expect(page).toHaveTitle(titre)
    expect(erreurs).toEqual([])
  })
}

test('une page protégée renvoie vers la connexion', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login\?suite=%2Fdashboard/)
})

test('mauvais identifiants : message clair', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[type=email]', 'personne@example.com')
  await page.fill('input[type=password]', 'mauvais-mot-de-passe')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible({ timeout: 30_000 })
})
