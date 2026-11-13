import { E2E_DISTRIBUTION } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

type Page = import('@playwright/test').Page

test.use(withRole('distributor'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

async function openMember(page: Page, name: string) {
  await page.goto('/distribution')
  await page.getByTestId('distribution-member-search').fill(name)
  await page.locator('[data-testid^="distribution-member-row-"]').filter({ hasText: name }).click()
  await expect(page.getByTestId('page-distribution-member')).toBeVisible()
}

function line(page: Page, productName: string) {
  return page.locator('[data-testid^="handover-line-"]', { hasText: productName })
}

/** US2 — adjust each line to what is actually handed over, validate, charge the member. */
test.describe('remise d’une commande', () => {
  test('ajuste les quantités, débite le solde et sort le stock', async ({ page }) => {
    await openMember(page, E2E_DISTRIBUTION.funded.name)

    // The seeded pre-order: 4 apples @ 3 € and 0.5 kg of cheese @ 20 €/kg = 22 €.
    const order = page.locator('[data-testid^="distribution-order-"]').first()
    // Hand over 3 apples instead of 4, and weigh the cheese at 0.6 kg.
    await line(page, E2E_DISTRIBUTION.readyProductName).getByTestId('handover-qty').fill('3')
    await line(page, E2E_DISTRIBUTION.weightProductName).getByTestId('handover-qty').fill('0.6')

    // 3 × 3 € + 0.6 × 20 € = 21 €, at the prices recorded when the order was placed.
    await expect(order.getByTestId('handover-total')).toContainText('21')

    await order.getByTestId('handover-submit').click()
    await expect(page.getByTestId('handover-receipt')).toBeVisible()

    // 60 € opening balance − 21 € = 39 €.
    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    await expect(
      page
        .locator('[data-testid^="distribution-member-row-"]')
        .filter({ hasText: E2E_DISTRIBUTION.funded.name }),
    ).toContainText('39')
  })

  test('laisse en attente une ligne refusée par l’adhérent', async ({ page }) => {
    await openMember(page, E2E_DISTRIBUTION.funded.name)
    const order = page.locator('[data-testid^="distribution-order-"]').first()

    await line(page, E2E_DISTRIBUTION.readyProductName).getByTestId('handover-qty').fill('0')
    await line(page, E2E_DISTRIBUTION.weightProductName).getByTestId('handover-qty').fill('0.5')
    // Only the cheese: 0.5 × 20 € = 10 €.
    await expect(order.getByTestId('handover-total')).toContainText('10')
    await order.getByTestId('handover-submit').click()
    await expect(page.getByTestId('handover-receipt')).toBeVisible()
  })

  test('refuse une deuxième validation de la même commande', async ({ page }) => {
    await openMember(page, E2E_DISTRIBUTION.funded.name)
    const order = page.locator('[data-testid^="distribution-order-"]').first()
    await order.getByTestId('handover-submit').click()
    await expect(page.getByTestId('handover-receipt')).toBeVisible()

    // Back on the member screen the order is gone — it is no longer pending.
    await openMember(page, E2E_DISTRIBUTION.funded.name)
    await expect(page.locator('[data-testid^="distribution-order-"]')).toHaveCount(1)
  })

  test('refuse la remise quand le solde ne couvre pas le total', async ({ page }) => {
    await openMember(page, E2E_DISTRIBUTION.broke.name)
    const order = page.locator('[data-testid^="distribution-order-"]').first()
    await order.getByTestId('handover-submit').click()

    await expect(page.getByTestId('handover-refusal')).toContainText('solde')
    // Nothing moved: the order is still there and the balance is still zero.
    await expect(page.getByTestId('distribution-member-balance')).toContainText('0')
    await expect(page.locator('[data-testid^="distribution-order-"]')).toHaveCount(1)
  })

  test('refuse la remise à un adhérent résilié', async ({ page }) => {
    await openMember(page, E2E_DISTRIBUTION.ended.name)
    await expect(page.getByTestId('distribution-member-status-warning')).toBeVisible()
    const order = page.locator('[data-testid^="distribution-order-"]').first()
    await order.getByTestId('handover-submit').click()
    await expect(page.getByTestId('handover-refusal')).toBeVisible()
  })

  test('empêche de valider une commande dont les marchandises ne sont pas arrivées', async ({
    page,
  }) => {
    await openMember(page, E2E_DISTRIBUTION.awaiting.name)
    const order = page.locator('[data-testid^="distribution-order-"]').first()
    await expect(order.getByTestId('handover-submit')).toBeDisabled()
  })

  test('remet la ligne livrée et laisse le reste en attente (FR-008)', async ({ page }) => {
    await openMember(page, E2E_DISTRIBUTION.partial.name)
    const order = page.locator('[data-testid^="distribution-order-"]').first()

    // Half the delivery is in, so the order is handable even though it is not fully ready.
    await expect(order.getByTestId('handover-submit')).toBeEnabled()
    // Only the delivered line counts: 2 apples × 3 € = 6 €. The leeks are not on the total.
    await expect(order.getByTestId('handover-total')).toContainText('6')
    await expect(order.getByTestId('handover-excluded')).toHaveCount(1)

    await order.getByTestId('handover-submit').click()
    await expect(page.getByTestId('handover-receipt')).toBeVisible()

    // The order is still outstanding, and neither line can be handed over now: one is
    // already given, the other is still waiting on its delivery.
    await openMember(page, E2E_DISTRIBUTION.partial.name)
    const reopened = page.locator('[data-testid^="distribution-order-"]').first()
    await expect(reopened.getByTestId('handover-excluded')).toHaveCount(2)
    await expect(reopened.getByTestId('handover-submit')).toBeDisabled()
    // 60 € − 6 € = 54 €, charged once.
    await expect(page.getByTestId('distribution-member-balance')).toContainText('54')
  })
})
