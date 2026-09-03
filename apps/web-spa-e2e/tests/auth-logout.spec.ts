import { E2E_PASSWORD, E2E_USERS } from '../env'
import { expect, test } from '../fixtures'

/**
 * Connexion via l'UI (pas de storageState partagé : `signOut` révoque la session côté
 * serveur, ça casserait les autres specs qui rejouent le même cookie), puis déconnexion.
 */
test('déconnexion depuis le dashboard → /login et session perdue', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('auth-login-identifier').fill(E2E_USERS.member)
  await page.getByTestId('auth-login-password').fill(E2E_PASSWORD)
  await page.getByTestId('auth-login-submit').click()
  await expect(page.getByTestId('page-dashboard-home')).toBeVisible()

  await page.getByTestId('dashboard-user-menu').click()
  await page.getByTestId('nav-logout').click()
  await expect(page).toHaveURL(/\/login/)

  // La session est réellement révoquée : revenir sur une route protégée rebondit.
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
