import { E2E_DISTRIBUTION } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

type Page = import('@playwright/test').Page

test.use(withRole('distributor'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

async function openExpress(page: Page, name: string) {
  await page.goto('/distribution')
  await page.getByTestId('distribution-member-search').fill(name)
  await page
    .locator('[data-testid^="distribution-member-row-"]')
    .filter({ hasText: name })
    .click()
  await page.getByTestId('distribution-start-express').click()
  await expect(page.getByTestId('page-express-order')).toBeVisible()
}

async function addProduct(page: Page, term: string) {
  await page.getByTestId('express-product-search').fill(term)
  await page.locator('[data-testid^="express-product-option-"]').first().click()
}

/** US3 — build an order at the table from current stock and validate it in one motion. */
test.describe('commande express', () => {
  test('ajoute par nom et par code-barres, puis encaisse', async ({ page }) => {
    await openExpress(page, E2E_DISTRIBUTION.funded.name)

    await addProduct(page, E2E_DISTRIBUTION.readyProductName)
    await addProduct(page, E2E_DISTRIBUTION.expressBarcode)
    await expect(page.locator('[data-testid^="express-line-"]')).toHaveCount(2)

    // 1 × 3 € + 1 × 7 € = 10 €.
    await expect(page.getByTestId('express-total')).toContainText('10')

    await page.getByTestId('express-submit').click()
    await expect(page.getByTestId('handover-receipt')).toBeVisible()

    // 60 € − 10 € = 50 €.
    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    await expect(
      page
        .locator('[data-testid^="distribution-member-row-"]')
        .filter({ hasText: E2E_DISTRIBUTION.funded.name }),
    ).toContainText('50')
  })

  test('retire une ligne avant validation, sans rien enregistrer', async ({ page }) => {
    await openExpress(page, E2E_DISTRIBUTION.funded.name)
    await addProduct(page, E2E_DISTRIBUTION.readyProductName)
    await expect(page.locator('[data-testid^="express-line-"]')).toHaveCount(1)

    await page.locator('[data-testid^="express-line-"]').first().getByTestId('express-remove').click()
    await expect(page.locator('[data-testid^="express-line-"]')).toHaveCount(0)
    await expect(page.getByTestId('express-submit')).toBeDisabled()

    // Nothing was charged: the balance is untouched.
    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    await expect(
      page
        .locator('[data-testid^="distribution-member-row-"]')
        .filter({ hasText: E2E_DISTRIBUTION.funded.name }),
    ).toContainText('60')
  })

  test('avertit au-delà du stock enregistré sans bloquer la vente', async ({ page }) => {
    await openExpress(page, E2E_DISTRIBUTION.funded.name)
    await addProduct(page, E2E_DISTRIBUTION.expressProductName)
    // 25 in stock; sell 30.
    await page.locator('[data-testid^="express-line-"]').first().getByTestId('express-qty').fill('30')

    await expect(page.getByTestId('express-over-stock')).toBeVisible()
    await expect(page.getByTestId('express-submit')).toBeEnabled()
  })

  test('refuse la vente quand le solde ne couvre pas le total', async ({ page }) => {
    await openExpress(page, E2E_DISTRIBUTION.broke.name)
    await addProduct(page, E2E_DISTRIBUTION.expressProductName)
    await page.getByTestId('express-submit').click()

    await expect(page.getByTestId('express-refusal')).toContainText('solde')
  })
})
