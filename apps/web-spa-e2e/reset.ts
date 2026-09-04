import { expect, request } from '@playwright/test'
import { E2E } from './env'

/**
 * Tronque les tables métier et rejoue `E2eSeeder` via `POST /api/test/seed/reset`, avec son
 * propre contexte de requête. Utilisable partout — la fixture `resetDb` (fixtures.ts) l'appelle
 * pour les specs, et les hooks `afterAll` l'appellent directement (les fixtures n'y sont pas
 * disponibles).
 */
export async function resetSeed(): Promise<void> {
  const context = await request.newContext({ baseURL: E2E.apiUrl })
  const response = await context.post('/api/test/seed/reset')
  expect(response.ok(), await response.text()).toBeTruthy()
  await context.dispose()
}
