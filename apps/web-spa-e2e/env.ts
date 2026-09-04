import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { E2E_USERS as E2E_USER_RECORDS, type E2eUserKey } from '../api/src/seeders/e2e.fixtures'

// Re-exported straight from the API's shared fixture file — the single source of truth for
// the E2E accounts, password and search names (`apps/api/src/seeders/e2e.fixtures.ts`).
export {
  E2E_PASSWORD,
  E2E_PRODUCT_BARCODE,
  E2E_SEARCH_MEMBER_NAME,
} from '../api/src/seeders/e2e.fixtures'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')

type Role = 'admin' | 'member' | 'pending'

/** Chemin de la session sauvegardée pour un rôle seedé (écrite par `auth.setup.ts`). */
export function storageStatePath(role: Role): string {
  return resolve(here, '.auth', `${role}.json`)
}

/** Charge `.env.e2e` dans `process.env` sans écraser ce qui est déjà défini. */
const { parsed: env = {} } = dotenv.config({ path: resolve(here, '.env.e2e') })

function required(key: string): string {
  const value = process.env[key] ?? env[key]
  if (!value) {
    throw new Error(`[web-spa-e2e] variable d'env manquante ${key} (voir .env.e2e)`)
  }
  return value
}

export const E2E = {
  repoRoot,
  apiUrl: required('API_BASE_URL'),
  webUrl: required('CLIENTS_WEB_APP_URL'),
  webPort: new URL(required('CLIENTS_WEB_APP_URL')).port || '5273',
  maildevUrl: process.env.MAILDEV_URL ?? env.MAILDEV_URL ?? 'http://localhost:1090',
  /** Passé aux process `webServer` de Playwright ; l'API complète depuis apps/api/.env.example. */
  processEnv: { ...env },
  storageStateDir: resolve(here, '.auth'),
} as const

/**
 * L'email de chaque compte seedé par `E2eSeeder`, indexé par rôle — les specs le saisissent
 * dans les champs texte. Dérivé des enregistrements partagés pour rester synchronisé.
 */
export const E2E_USERS = Object.fromEntries(
  Object.entries(E2E_USER_RECORDS).map(([key, record]) => [key, record.email]),
) as Record<E2eUserKey, string>
