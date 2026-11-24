import { resolve } from 'node:path'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

const swcPlugin = swc.vite({
  module: { type: 'es6' },
})

const resolveAlias = {
  src: resolve(__dirname, './src'),
}

export default defineConfig({
  build: {
    sourcemap: true,
  },
  server: {
    fs: {
      strict: false,
    },
  },
  plugins: [swcPlugin],
  resolve: {
    alias: resolveAlias,
  },
  test: {
    root: resolve(__dirname, './src/test'),
    environment: 'node',
    pool: 'threads',
    globals: true,
    globalSetup: resolve(__dirname, './src/test/setup/test.global-setup.ts'),
    projects: [
      {
        plugins: [swcPlugin],
        resolve: { alias: resolveAlias },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['../**/*.spec.ts'],
          setupFiles: [resolve(__dirname, './src/test/setup/test.setup.ts')],
          // Several unit specs (wallet, distribution) open a real database in `beforeEach`:
          // `createTestOrm` creates a fresh database and rebuilds the whole schema. Under load
          // that passes 10s, the default.
          hookTimeout: 60000,
          // Each test builds a Nest app and clones a database. Under load the 5 s default is
          // too short: eight tests failed on it in one pre-push run and passed when run alone.
          testTimeout: 30000,
        },
      },
      {
        plugins: [swcPlugin],
        resolve: { alias: resolveAlias },
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          include: ['../**/*.e2e-spec.ts'],
          setupFiles: [
            resolve(__dirname, './src/test/setup/test.setup.ts'),
            resolve(__dirname, './src/test/setup/test.e2e-setup.ts'),
          ],
          // Container startup (PostgreSQL via testcontainers) can take >10s in CI
          hookTimeout: 60000,
          // Same reason as the unit project.
          testTimeout: 30000,
        },
      },
    ],
  },
})
