import { expect, test, withRole } from '../fixtures'

/**
 * Gardes de route. L'espace adhérent et le back-office sont gardés par
 * `authClient.useSession()` ; `auth-layout` renvoie un utilisateur connecté hors de `/login`.
 */
test.describe('non connecté', () => {
  for (const path of ['/account', '/cart', '/admin/members']) {
    test(`redirige ${path} → /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
      await expect(page.getByTestId('page-login')).toBeVisible()
    })
  }
})

test.describe('connecté', () => {
  test.use(withRole('member'))

  test('la route index arrive sur la boutique', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/shop/)
    await expect(page.getByTestId('page-shop')).toBeVisible()
  })
})
