import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { E2E } from '../env'

const apiDir = resolve(E2E.repoRoot, 'apps/api')

/**
 * Recrée le schéma e2e depuis les entités (pas les migrations) et exécute `E2eSeeder`.
 * `schema:fresh` est rapide et déterministe.
 */
export function resetE2eDatabase(): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      'pnpm',
      ['exec', 'mikro-orm', 'schema:fresh', '--run', '--seed', 'E2eSeeder'],
      {
        cwd: apiDir,
        stdio: 'inherit',
        env: { ...process.env, ...E2E.processEnv, NODE_ENV: 'test' },
      },
    )
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
      } else {
        reject(new Error(`schema:fresh --seed E2eSeeder a terminé avec le code ${code}`))
      }
    })
  })
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  resetE2eDatabase().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
