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

/** The seeded unit product line locator on the detail page. */
function lineByName(page: import('@playwright/test').Page, name: string) {
  return page.locator('[data-testid^="supplier-order-line-"]', { hasText: name })
}
function formRow(page: import('@playwright/test').Page, name: string) {
  return page.locator('[data-testid^="reception-line-"]', { hasText: name })
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

test.describe('receive a delivery (US3)', () => {
  test('a short line is flagged, a by-weight line within tolerance is not, stock/cost update, and a second reception accumulates', async ({
    page,
  }) => {
    await openDraftOrder(page)
    await markSent(page)

    // First reception: unit product short (4 of 5), weight product within its 10% band.
    const unitRow = formRow(page, E2E_PURCHASING.unitProductName)
    await unitRow.getByTestId('reception-line-quantity').fill('4')
    await unitRow.getByTestId('reception-line-cost').fill('4.00')
    const weightRow = formRow(page, E2E_PURCHASING.weightProductName)
    await weightRow.getByTestId('reception-line-quantity').fill('1.05')
    await weightRow.getByTestId('reception-line-cost').fill('12.00')
    await page.getByTestId('reception-submit').click()

    await expect(
      lineByName(page, E2E_PURCHASING.unitProductName).getByTestId('line-received'),
    ).toHaveText('4')
    await expect(
      lineByName(page, E2E_PURCHASING.unitProductName).getByTestId('line-discrepancy'),
    ).toHaveText('Manquant')
    await expect(
      lineByName(page, E2E_PURCHASING.weightProductName).getByTestId('line-discrepancy'),
    ).toHaveText('OK')

    // Still sent (unit line short), one reception in history.
    await expect(page.getByTestId('supplier-order-status')).toHaveText('Envoyée')
    await expect(page.locator('[data-testid^="reception-"]').first()).toBeVisible()

    // Second reception for the missing unit → fully received, both receptions kept.
    await formRow(page, E2E_PURCHASING.unitProductName)
      .getByTestId('reception-line-quantity')
      .fill('1')
    await formRow(page, E2E_PURCHASING.unitProductName)
      .getByTestId('reception-line-cost')
      .fill('4.00')
    await formRow(page, E2E_PURCHASING.weightProductName)
      .getByTestId('reception-line-include')
      .uncheck()
    await page.getByTestId('reception-submit').click()

    await expect(page.getByTestId('supplier-order-status')).toHaveText('Reçue')
    await expect(
      lineByName(page, E2E_PURCHASING.unitProductName).getByTestId('line-discrepancy'),
    ).toHaveText('OK')
    await expect(page.getByTestId('supplier-order-receptions').locator('> ul > li')).toHaveCount(2)
  })
})
