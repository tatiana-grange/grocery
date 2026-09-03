import { test as base, expect } from '@playwright/test'
import { storageStatePath } from './env'
import { resetSeed } from './reset'

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
    await use(resetSeed)
  },
})

/** Raccourci pour les specs authentifiées : `test.use(withRole('admin'))`. */
export function withRole(role: 'admin' | 'member' | 'pending') {
  return { storageState: storageStatePath(role) }
}
