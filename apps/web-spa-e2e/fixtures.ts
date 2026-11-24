import { test as base, type Browser, expect } from '@playwright/test'
import { E2E, storageStatePath } from './env'
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

type Role = 'admin' | 'member' | 'pending' | 'distributor'

/** Raccourci pour les specs authentifiées : `test.use(withRole('admin'))`. */
export function withRole(role: Role) {
  return { storageState: storageStatePath(role) }
}

/** A second browser signed in as another role, beside the spec's own page. Close its context. */
export async function newRolePage(browser: Browser, role: Role) {
  const context = await browser.newContext({
    baseURL: E2E.webUrl,
    locale: 'fr-FR',
    storageState: storageStatePath(role),
  })
  return { context, page: await context.newPage() }
}
