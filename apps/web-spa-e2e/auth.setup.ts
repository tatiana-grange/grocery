import { mkdir } from 'node:fs/promises'
import { expect, request, test } from '@playwright/test'
import { E2E, E2E_PASSWORD, E2E_USERS, storageStatePath } from './env'

/**
 * Connecte chaque rôle non banni via le vrai flux better-auth email + mot de passe et
 * persiste la session. Les specs démarrent alors authentifiées sans rejouer le flux.
 * Tourne comme le projet Playwright `setup`.
 */
test('authenticate seeded users', async () => {
  await mkdir(E2E.storageStateDir, { recursive: true })

  for (const role of ['admin', 'member', 'pending'] as const) {
    const email = E2E_USERS[role]
    const context = await request.newContext({ baseURL: E2E.apiUrl })

    const response = await context.post('/api/auth/sign-in/email', {
      data: { email, password: E2E_PASSWORD, rememberMe: true },
    })
    expect(response.ok(), await response.text()).toBeTruthy()

    await context.storageState({ path: storageStatePath(role) })
    await context.dispose()
  }
})
