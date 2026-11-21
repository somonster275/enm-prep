import { defineConfig } from '@playwright/test'

// Tests de bout en bout. Les tests connectés ont besoin d'un compte de test :
//   E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
// ⚠️ Ils écrivent dans la vraie base (progression, résultats de QCM) : n'utiliser qu'un compte de test.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000, // le serveur de dev compile chaque page à la première visite
  use: { baseURL: 'http://localhost:3000', trace: 'off' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 180_000 },
  projects: [
    { name: 'public', testMatch: /public\.spec\.ts/ },
    // Tests connectés : seulement si le compte de test est fourni.
    ...(process.env.E2E_EMAIL && process.env.E2E_PASSWORD ? [
      { name: 'connexion', testMatch: /auth\.setup\.ts/ },
      { name: 'connecte', testMatch: /(revision|qcm)\.spec\.ts/, dependencies: ['connexion'], use: { storageState: 'e2e/.auth/session.json' } },
    ] : []),
  ],
})
