import { E2E_PURCHASING } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

type Page = import('@playwright/test').Page

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

function formRow(page: Page, name: string) {
  return page.locator('[data-testid^="reception-line-"]', { hasText: name })
}

/** Aggregate → send → receive the seeded unit product twice at different unit costs. */
async function receiveUnitProductTwice(page: Page) {
  await page.goto('/admin/catalog')
  await page.getByTestId('catalog-tab-suppliers').click()
  await page
    .getByTestId(`supplier-row-${E2E_PURCHASING.supplierName}`)
    .getByTestId('supplier-aggregate')
    .click()
  await expect(page.getByTestId('page-supplier-order-detail')).toBeVisible()
  await page.getByTestId('supplier-order-send').click()
  await expect(page.getByTestId('supplier-order-status')).toHaveText('Envoyée')

  // First: 3 units @ 4.00 €. Leave the weight line out.
  await formRow(page, E2E_PURCHASING.unitProductName)
    .getByTestId('reception-line-quantity')
    .fill('3')
  await formRow(page, E2E_PURCHASING.unitProductName)
    .getByTestId('reception-line-cost')
    .fill('4.00')
  await formRow(page, E2E_PURCHASING.weightProductName)
    .getByTestId('reception-line-include')
    .uncheck()
  await page.getByTestId('reception-submit').click()
  await expect(page.getByTestId('supplier-order-receptions').locator('> ul > li')).toHaveCount(1)

  // Second: the missing 2 units @ 5.00 €.
  await formRow(page, E2E_PURCHASING.unitProductName)
    .getByTestId('reception-line-quantity')
    .fill('2')
  await formRow(page, E2E_PURCHASING.unitProductName)
    .getByTestId('reception-line-cost')
    .fill('5.00')
  await formRow(page, E2E_PURCHASING.weightProductName)
    .getByTestId('reception-line-include')
    .uncheck()
  await page.getByTestId('reception-submit').click()
}

test('a never-received product shows 0 on hand and no cost price (FR-020)', async ({ page }) => {
  await page.goto('/admin/inventory')
  await expect(page.getByTestId('page-stock-list')).toBeVisible()

  const row = page.getByTestId('stock-row-Pommes Golden')
  await expect(row.getByTestId('stock-row-on-hand')).toHaveText('0')
  await expect(row.getByTestId('stock-row-cost')).toHaveText('—')
})

test('a product received twice at different unit costs shows the quantity-weighted average', async ({
  page,
}) => {
  await receiveUnitProductTwice(page)

  // (3 * 4.00 + 2 * 5.00) / 5 = 4.40 €
  await page.goto('/admin/inventory')
  await page.getByTestId('stock-search').fill(E2E_PURCHASING.unitProductName)
  await page.getByTestId('stock-search').press('Enter')

  const row = page.getByTestId(`stock-row-${E2E_PURCHASING.unitProductName}`)
  await expect(row.getByTestId('stock-row-on-hand')).toHaveText('5')
  await expect(row.getByTestId('stock-row-cost')).toContainText('4.40')

  await row.getByTestId('stock-row-open').click()
  await expect(page.getByTestId('page-stock-detail')).toBeVisible()
  await expect(page.getByTestId('stock-detail-on-hand')).toContainText('5')
  await expect(page.getByTestId('stock-detail-cost')).toContainText('4.40')
  // Both movements, each from a reception.
  await expect(page.locator('[data-testid^="stock-movement-"]')).toHaveCount(2)
})
