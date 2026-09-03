import { defineConfig, devices } from '@playwright/test'
import { E2E } from './env'

const isCI = !!process.env.CI
// E2E_VERBOSE=1 pour voir les logs des serveurs API / SPA (utile si un serveur ne boote pas).
const serverStdout = process.env.E2E_VERBOSE ? 'pipe' : 'ignore'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  globalSetup: './global-setup.ts',
  // Le SPA en dev + la première session après un reseed peuvent être lents à froid.
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: E2E.webUrl,
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
    // L'app détecte la langue du navigateur — on fige le français, langue par défaut du projet.
    locale: 'fr-FR',
  },

  projects: [
    // `auth.setup.ts` lives at the package root, outside `testDir`, so this project points
    // its own `testDir` there.
    { name: 'setup', testDir: '.', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /tests\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      // `nest start` (pas `dev`/`--watch`) : Playwright gère le cycle de vie, et le mode
      // watch redémarrait l'API en cours de suite (sessions/timeouts intermittents).
      command: 'pnpm --filter @grocery/api exec nest start',
      cwd: E2E.repoRoot,
      url: `${E2E.apiUrl}/api`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: serverStdout,
      stderr: 'pipe',
      env: { ...E2E.processEnv, NODE_ENV: 'test' },
    },
    {
      command: `pnpm --filter @grocery/web-spa dev --port ${E2E.webPort} --host 127.0.0.1`,
      cwd: E2E.repoRoot,
      url: E2E.webUrl,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: serverStdout,
      stderr: 'pipe',
      env: { ...E2E.processEnv },
    },
  ],
})
