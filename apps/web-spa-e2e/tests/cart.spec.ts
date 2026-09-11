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
    await page.getByTestId('add-to-cart-submit').click()
    await expect(page.getByTestId('site-nav-cart-count')).toHaveText('1')

    // The add button is replaced by the stepper for the new line; the exact weight is set there.
    await page.getByTestId('add-to-cart-quantity').fill('2')
    await page.getByTestId('add-to-cart-quantity').blur()

    await openProduct(page, 'Panier de légumes du producteur')
    await page.getByTestId('add-to-cart-submit').click()
    await expect(page.getByTestId('site-nav-cart-count')).toHaveText('2')

    await page.getByTestId('site-nav-cart').click()
    await expect(page.getByTestId('page-cart')).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(2)

    // Adjust the "Panier de légumes du producteur" line (unit sale, +1 piece moves the total
    // by a whole 18 €, unlike the by-weight line's fractional step) and confirm the total moves.
    const totalBefore = await page.getByTestId('cart-total').innerText()
    const preOrderRow = page.locator('tr', { hasText: 'Panier de légumes du producteur' })
    await preOrderRow.locator('[data-testid^="cart-line-increase-"]').click()
    await expect(page.getByTestId('cart-total')).not.toHaveText(totalBefore)

    // Remove the "Panier de légumes du producteur" line.
    await preOrderRow.locator('[data-testid^="cart-line-remove-"]').first().click()
    await page.locator('[data-testid^="cart-line-remove-confirm-"]').click()

    await expect(page.locator('tbody tr')).toHaveCount(1)
  })

  test('ajout rapide et ajustement depuis la grille de la boutique', async ({ page }) => {
    await page.goto('/shop')
    await page.getByTestId('shop-search').fill('Pain de campagne')
    await page.getByTestId('shop-search').press('Enter')

    const card = page
      .getByTestId('shop-product-grid')
      .locator('> *')
      .filter({ hasText: 'Pain de campagne' })
    await card.locator('[data-testid^="quick-add-submit-"]').click()
    await expect(page.getByTestId('site-nav-cart-count')).toHaveText('1')

    // The submit button is replaced by a stepper bound to the new cart line.
    await card.locator('[data-testid^="quick-add-increase-"]').click()
    await expect(card.locator('[data-testid^="quick-add-quantity-"]')).toHaveText('2')

    await card.locator('[data-testid^="quick-add-decrease-"]').click()
    await card.locator('[data-testid^="quick-add-decrease-"]').click()

    // Stepping to zero removes the line and brings the submit button back.
    await expect(card.locator('[data-testid^="quick-add-submit-"]')).toBeVisible()
    await expect(page.getByTestId('site-nav-cart-count')).toBeHidden()
  })

  test('produit au poids : saisie du poids exact depuis la grille', async ({ page }) => {
    await page.goto('/shop')
    await page.getByTestId('shop-search').fill('Pommes Golden')
    await page.getByTestId('shop-search').press('Enter')

    const card = page
      .getByTestId('shop-product-grid')
      .locator('> *')
      .filter({ hasText: 'Pommes Golden' })
    await card.locator('[data-testid^="quick-add-submit-"]').click()
    await expect(page.getByTestId('site-nav-cart-count')).toHaveText('1')

    // The by-weight line exposes an editable amount, not just +/-.
    const amount = card.locator('[data-testid^="quick-add-quantity-"]')
    await amount.fill('1.75')
    await amount.blur()

    await page.getByTestId('site-nav-cart').click()
    const row = page.locator('tr', { hasText: 'Pommes Golden' })
    await expect(row.locator('[data-testid^="cart-line-quantity-"]')).toHaveValue('1.75')
  })

  test('produit servi en grammes : le sélecteur avance par pas de 200 g', async ({ page }) => {
    await page.goto('/shop')
    await page.getByTestId('shop-search').fill('Comté à la coupe')
    await page.getByTestId('shop-search').press('Enter')

    const card = page
      .getByTestId('shop-product-grid')
      .locator('> *')
      .filter({ hasText: 'Comté à la coupe' })
    await card.locator('[data-testid^="quick-add-submit-"]').click()
    await expect(page.getByTestId('site-nav-cart-count')).toHaveText('1')
    // Adding puts one step in the cart, shown in grams.
    await expect(card.locator('[data-testid^="quick-add-quantity-"]')).toHaveValue('200')

    await card.locator('[data-testid^="quick-add-increase-"]').click()
    await expect(card.locator('[data-testid^="quick-add-quantity-"]')).toHaveValue('400')

    await page.getByTestId('site-nav-cart').click()
    const row = page.locator('tr', { hasText: 'Comté à la coupe' })
    // The cart page shows the same grams unit and 200 g step as the shop card.
    await expect(row.locator('[data-testid^="cart-line-quantity-"]')).toHaveValue('400')
    await row.locator('[data-testid^="cart-line-increase-"]').click()
    await expect(row.locator('[data-testid^="cart-line-quantity-"]')).toHaveValue('600')
  })

  test('un produit "both" laisse choisir le mode de commande', async ({ page }) => {
    await openProduct(page, 'Carottes en vrac')
    await expect(page.getByTestId('add-to-cart-orderingmode-pre_order')).toBeVisible()
    await page.getByTestId('add-to-cart-orderingmode-pre_order').click()
    await page.getByTestId('add-to-cart-submit').click()

    await page.getByTestId('site-nav-cart').click()
    const row = page.locator('tr', { hasText: 'Carottes en vrac' })
    await expect(row.getByText('Précommande')).toBeVisible()
  })
})
