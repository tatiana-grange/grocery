import { expect, test, withRole } from '../fixtures'

async function openProduct(page: import('@playwright/test').Page, name: string) {
  await page.goto('/shop')
  await page.getByTestId('shop-search').fill(name)
  await page.getByTestId('shop-search').press('Enter')
  await page.getByTestId('shop-product-card-name').filter({ hasText: name }).click()
  await expect(page.getByTestId('page-shop-product-detail')).toBeVisible()
}

test.describe('visiteur non connecté', () => {
  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test('ajouter au panier redirige vers la connexion', async ({ page }) => {
    await openProduct(page, 'Pommes Golden')
    await page.getByTestId('add-to-cart-signin').click()

    await expect(page).toHaveURL(/\/login\?redirect=/)
  })
})

test.describe('membre connecté', () => {
  test.use(withRole('member'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test('ajouter, ajuster et retirer des lignes de panier', async ({ page }) => {
    await openProduct(page, 'Pommes Golden')
    await page.getByTestId('add-to-cart-quantity').fill('2')
    await page.getByTestId('add-to-cart-submit').click()
    await expect(page.getByTestId('shop-nav-cart-count')).toHaveText('1')

    await openProduct(page, 'Panier de légumes du producteur')
    await page.getByTestId('add-to-cart-submit').click()
    await expect(page.getByTestId('shop-nav-cart-count')).toHaveText('2')

    await page.getByTestId('shop-nav-cart').click()
    await expect(page.getByTestId('page-cart')).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(2)

    // Adjust the "Panier de légumes du producteur" line (unit sale, +1 piece moves the total
    // by a whole 18 €, unlike the by-weight line's 1-gram step) and confirm the total moves.
    const totalBefore = await page.getByTestId('cart-total').innerText()
    const preOrderRow = page.locator('tr', { hasText: 'Panier de légumes du producteur' })
    await preOrderRow.locator('[data-testid^="cart-line-increase-"]').click()
    await expect(page.getByTestId('cart-total')).not.toHaveText(totalBefore)

    // Remove the "Panier de légumes du producteur" line.
    await preOrderRow.locator('[data-testid^="cart-line-remove-"]').first().click()
    await page.locator('[data-testid^="cart-line-remove-confirm-"]').click()

    await expect(page.locator('tbody tr')).toHaveCount(1)
  })

  test('un produit "both" laisse choisir le mode de commande', async ({ page }) => {
    await openProduct(page, 'Carottes en vrac')
    await expect(page.getByTestId('add-to-cart-orderingmode-pre_order')).toBeVisible()
    await page.getByTestId('add-to-cart-orderingmode-pre_order').click()
    await page.getByTestId('add-to-cart-submit').click()

    await page.getByTestId('shop-nav-cart').click()
    const row = page.locator('tr', { hasText: 'Carottes en vrac' })
    await expect(row.getByText('Précommande')).toBeVisible()
  })
})
