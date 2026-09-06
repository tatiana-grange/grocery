import { E2E_PURCHASING } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

async function aggregateFor(page: import('@playwright/test').Page, supplierName: string) {
  await page.goto('/admin/catalog')
  await page.getByTestId('catalog-tab-suppliers').click()
  await page.getByTestId(`supplier-row-${supplierName}`).getByTestId('supplier-aggregate').click()
}

test('aggregates a supplier’s pending pre-orders into a draft supplier order with summed quantities', async ({
  page,
}) => {
  await aggregateFor(page, E2E_PURCHASING.supplierName)

  await expect(page.getByTestId('page-supplier-order-detail')).toBeVisible()
  await expect(page.getByTestId('supplier-order-status')).toHaveText('Brouillon')

  // Two members pre-ordered the unit product (2 + 3) → one line, quantity 5.
  const lines = page.locator('[data-testid^="supplier-order-line-"]')
  await expect(lines).toHaveCount(2)
  await expect(
    page
      .locator('[data-testid^="supplier-order-line-"]', {
        hasText: E2E_PURCHASING.unitProductName,
      })
      .getByTestId('line-ordered'),
  ).toHaveText('5')

  // The archived product's pre-order was skipped and reported.
  const skipped = page.getByTestId('supplier-order-skipped')
  await expect(skipped).toBeVisible()
  await expect(skipped).toContainText(E2E_PURCHASING.archivedProductName)
})

test('a second aggregation with nothing new is refused with an explanation (FR-004)', async ({
  page,
}) => {
  await aggregateFor(page, E2E_PURCHASING.supplierName)
  await expect(page.getByTestId('page-supplier-order-detail')).toBeVisible()

  await aggregateFor(page, E2E_PURCHASING.supplierName)
  await expect(page.getByText('Rien à agréger pour ce fournisseur')).toBeVisible()
})

test('the draft supplier order shows up in the purchasing list', async ({ page }) => {
  await aggregateFor(page, E2E_PURCHASING.supplierName)
  await expect(page.getByTestId('page-supplier-order-detail')).toBeVisible()

  await page.goto('/admin/purchasing')
  await expect(page.getByTestId('page-supplier-orders-list')).toBeVisible()
  const row = page
    .locator('[data-testid^="supplier-orders-row-"]')
    .filter({ hasText: E2E_PURCHASING.supplierName })
  await expect(row).toHaveCount(1)
  await expect(row.getByTestId('supplier-orders-row-status')).toHaveText('Brouillon')
})
