import { E2E_PASSWORD, E2E_USERS } from '../env'
import { expect, test } from '../fixtures'

/**
 * Socle : prouve toute la chaîne — infra up, schéma seedé, API + SPA bootés, connexion
 * better-auth email + mot de passe, et l'arrivée sur la boutique. Connexion via la vraie
 * UI (pas de storageState) : rien n'est mocké.
 */
test('connexion email + mot de passe → boutique', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByTestId('page-login')).toBeVisible()

  await page.getByTestId('auth-login-identifier').fill(E2E_USERS.member)
  await page.getByTestId('auth-login-password').fill(E2E_PASSWORD)
  await page.getByTestId('auth-login-submit').click()

  await expect(page).toHaveURL(/\/shop/)
  await expect(page.getByTestId('page-shop')).toBeVisible()
})
