import { E2E_PASSWORD, E2E_USERS } from '../env'
import { expect, test } from '../fixtures'

/** Erreurs de connexion, via la vraie UI (aucun storageState). */
test('mauvais mot de passe → message identifiants incorrects', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('auth-login-identifier').fill(E2E_USERS.member)
  await page.getByTestId('auth-login-password').fill('wrong-password')
  await page.getByTestId('auth-login-submit').click()

  await expect(page.getByTestId('auth-login-error')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('utilisateur banni → message dédié', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('auth-login-identifier').fill(E2E_USERS.banned)
  await page.getByTestId('auth-login-password').fill(E2E_PASSWORD)
  await page.getByTestId('auth-login-submit').click()

  await expect(page.getByTestId('auth-login-error-banned')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})
