import type { FullConfig } from '@playwright/test'
import { resetE2eDatabase } from './scripts/reset-db'

/**
 * Tourne une fois avant toute la suite : recrée le schéma + seed la baseline lecture seule.
 * L'isolation par test est gérée par la fixture `resetDb` qui appelle
 * `POST /api/test/seed/reset`.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  await resetE2eDatabase()
}

export default globalSetup
