import { expect, test, withRole } from '../fixtures'

/**
 * Le menu réglages (thème + langue) vit dans la barre de chaque coquille. On le teste
 * depuis la boutique, où il est visible connecté comme déconnecté.
 */
test.use(withRole('member'))

test('bascule de thème clair → sombre', async ({ page }) => {
  await page.goto('/shop')
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('app-settings-theme').click()
  await expect(page.locator('body')).toHaveClass(/dark/)
})

test('changement de langue fr → en', async ({ page }) => {
  await page.goto('/shop')
  await expect(page.getByTestId('page-shop')).toBeVisible()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('app-settings-lang-en').click()

  await expect(page.getByTestId('shop-title')).toHaveText('Shop')
})
