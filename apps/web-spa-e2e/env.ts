import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

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

/** Les comptes seedés par `E2eSeeder` (apps/api/src/seeders/e2e.seeder.ts). */
export const E2E_USERS = {
  admin: 'admin@e2e.local',
  member: 'member@e2e.local',
  pending: 'pending@e2e.local',
  banned: 'banned@e2e.local',
  /** Adhérent actif dédié au parcours de résiliation (ses sessions sont révoquées). */
  resign: 'resign@e2e.local',
  /** Adhérent actif dédié au changement de mot de passe (ce flux fait tourner la session). */
  pwtest: 'pwtest@e2e.local',
} as const

export const E2E_PASSWORD = 'Password123!'

/** Nom d'un adhérent actif seedé, cherché par la spec de recherche de la liste. */
export const E2E_SEARCH_MEMBER_NAME = 'Zelda Searchable'
