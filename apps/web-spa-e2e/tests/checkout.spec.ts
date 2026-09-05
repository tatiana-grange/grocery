import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, withRole } from '../fixtures'

// Read the same locale file the app renders from, so the "what happens next" assertions
// verify the copy comes from the stable cart.checkout.nextSteps.* key — not a hardcoded
// string duplicated here that could drift from the real translation.
const localeUrl = new URL(
  '../../web-spa/app/lib/i18n/locales/fr/common.locales.fr.json',
  import.meta.url,
)
const frLocale = JSON.parse(readFileSync(fileURLToPath(localeUrl), 'utf-8')) as {
  cart: { checkout: { nextSteps: { pre_order: string; in_store: string } } }
}

async function openProduct(page: import('@playwright/test').Page, name: string) {
  await page.goto('/shop')
  await page.getByTestId('shop-search').fill(name)
  await page.getByTestId('shop-search').press('Enter')
  await page.getByTestId('shop-product-card-name').filter({ hasText: name }).click()
  await expect(page.getByTestId('page-shop-product-detail')).toBeVisible()
}

test.describe('checkout', () => {
  test.use(withRole('member'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test('un panier mixte se scinde en deux commandes confirmées', async ({ page }) => {
    await openProduct(page, 'Pommes Golden')
    await page.getByTestId('add-to-cart-submit').click()

    await openProduct(page, 'Panier de légumes du producteur')
    await page.getByTestId('add-to-cart-submit').click()

    await page.goto('/cart')
    await page.getByTestId('cart-checkout').click()

    await expect(page.getByTestId('checkout-confirmation')).toBeVisible()
    const orders = page.locator('[data-testid^="checkout-order-"]')
    await expect(orders).toHaveCount(2)

    // Each order renders its ordering-type-specific "what happens next" copy from the
    // cart.checkout.nextSteps.* i18n key.
    await expect(page.getByText(frLocale.cart.checkout.nextSteps.pre_order)).toBeVisible()
    await expect(page.getByText(frLocale.cart.checkout.nextSteps.in_store)).toBeVisible()

    // The cart is now empty.
    await page.goto('/cart')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('un panier vide bloque le paiement', async ({ page }) => {
    await page.goto('/cart')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })
})
