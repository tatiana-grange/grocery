import { expect, test, withRole } from '../fixtures'

/**
 * Gardes de route. Le dashboard, l'espace adhérent et le back-office sont gardés par
 * `authClient.useSession()` ; `auth-layout` renvoie un utilisateur connecté hors de `/login`.
 */
test.describe('non connecté', () => {
  for (const path of ['/dashboard', '/dashboard/profile', '/account', '/admin/members']) {
    test(`redirige ${path} → /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
      await expect(page.getByTestId('page-login')).toBeVisible()
    })
  }
})

test.describe('connecté', () => {
  test.use(withRole('member'))

  test('la route index arrive sur le dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByTestId('page-dashboard-home')).toBeVisible()
  })
})
