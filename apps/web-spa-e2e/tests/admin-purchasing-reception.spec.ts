import { E2E_PURCHASING } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

/** Aggregate the seeded purchasing supplier's pre-orders and land on the draft order. */
async function openDraftOrder(page: import('@playwright/test').Page) {
  await page.goto('/admin/catalog')
  await page.getByTestId('catalog-tab-suppliers').click()
  await page
    .getByTestId(`supplier-row-${E2E_PURCHASING.supplierName}`)
    .getByTestId('supplier-aggregate')
    .click()
  await expect(page.getByTestId('page-supplier-order-detail')).toBeVisible()
}

async function markSent(page: import('@playwright/test').Page) {
  await page.getByTestId('supplier-order-send').click()
  await expect(page.getByTestId('supplier-order-status')).toHaveText('Envoyée')
}

test.describe('send a supplier order (US2)', () => {
  test('review a draft, mark it sent, and see the send action disappear (FR-008)', async ({
    page,
  }) => {
    await openDraftOrder(page)

    await expect(page.getByTestId('supplier-order-status')).toHaveText('Brouillon')
    await expect(page.locator('[data-testid^="supplier-order-line-"]')).toHaveCount(2)
    await expect(page.getByTestId('supplier-order-total')).toBeVisible()

    await markSent(page)

    // Re-sending is not offered once the order is sent.
    await expect(page.getByTestId('supplier-order-send')).toHaveCount(0)
    await expect(page.getByTestId('supplier-order-export')).toBeVisible()
  })

  test('a later aggregation run leaves the sent order’s lines untouched (FR-007)', async ({
    page,
  }) => {
    await openDraftOrder(page)
    const url = page.url()
    await markSent(page)

    // Nothing new is pending, so a second run is refused — the sent order is not disturbed.
    await page.goto('/admin/catalog')
    await page.getByTestId('catalog-tab-suppliers').click()
    await page
      .getByTestId(`supplier-row-${E2E_PURCHASING.supplierName}`)
      .getByTestId('supplier-aggregate')
      .click()
    await expect(page.getByText('Rien à agréger pour ce fournisseur')).toBeVisible()

    await page.goto(url)
    await expect(page.getByTestId('supplier-order-status')).toHaveText('Envoyée')
    await expect(page.locator('[data-testid^="supplier-order-line-"]')).toHaveCount(2)
  })
})
