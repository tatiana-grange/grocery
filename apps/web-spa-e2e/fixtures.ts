import { test as base, expect, request } from '@playwright/test'
import { E2E, storageStatePath } from './env'

export { expect }

interface E2eFixtures {
  /**
   * Tronque les tables métier et rejoue `E2eSeeder` via `POST /api/test/seed/reset`.
   * Pas automatique : à appeler explicitement (dans un `beforeEach`) depuis les specs qui
   * mutent des données partagées. Les tables Better Auth sont préservées, donc un
   * `storageState` sauvegardé reste valide — pas besoin de se ré-authentifier.
   */
  resetDb: () => Promise<void>
}

export const test = base.extend<E2eFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright exige l'argument fixtures
  resetDb: async ({}, use) => {
    await use(async () => {
      const context = await request.newContext({ baseURL: E2E.apiUrl })
      const response = await context.post('/api/test/seed/reset')
      expect(response.ok(), await response.text()).toBeTruthy()
      await context.dispose()
    })
  },
})

/** Raccourci pour les specs authentifiées : `test.use(withRole('admin'))`. */
export function withRole(role: 'admin' | 'member' | 'pending') {
  return { storageState: storageStatePath(role) }
}
