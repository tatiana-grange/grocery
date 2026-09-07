import process from 'node:process'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), devtoolsJson()],
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
  },
  server: {
    port: 5174,
  },
  optimizeDeps: {
    // Pre-bundle these so a lazy route that is the first to use one (the shop uses the
    // accordion and the dialog-backed sheet) does not trigger an on-the-fly re-optimize
    // and the "outdated optimize dep" full reload that comes with it.
    include: ['@tanstack/react-query', 'zod', '@base-ui/react/accordion', '@base-ui/react/dialog'],
  },
})
