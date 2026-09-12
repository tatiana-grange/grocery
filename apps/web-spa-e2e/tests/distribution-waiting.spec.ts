import { E2E_DISTRIBUTION } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

test.use(withRole('distributor'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

/** US5 — work through a distribution from the lists rather than reactively. */
test.describe('listes d’attente', () => {
  test('sépare les précommandes des commandes sur stock', async ({ page }) => {
    await page.goto('/distribution')

    await page.getByTestId('waiting-tab-pre_order').click()
    await expect(page.getByTestId('waiting-list')).toContainText(E2E_DISTRIBUTION.funded.name)
    await expect(page.getByTestId('waiting-list')).toContainText(E2E_DISTRIBUTION.awaiting.name)

    await page.getByTestId('waiting-tab-in_store').click()
    // Bruno's and Elio's in-store orders; no pre-order member here.
    await expect(page.getByTestId('waiting-list')).toContainText(E2E_DISTRIBUTION.broke.name)
    await expect(page.getByTestId('waiting-list')).not.toContainText(
      E2E_DISTRIBUTION.awaiting.name,
    )
  })

  test('ouvre l’écran de l’adhérent depuis une ligne', async ({ page }) => {
    await page.goto('/distribution')
    await page.getByTestId('waiting-tab-pre_order').click()
    await page
      .locator('[data-testid^="waiting-row-"]')
      .filter({ hasText: E2E_DISTRIBUTION.funded.name })
      .click()
    await expect(page.getByTestId('page-distribution-member')).toBeVisible()
  })

  test('retire la commande de la liste une fois remise', async ({ page }) => {
    await page.goto('/distribution')
    await page.getByTestId('waiting-tab-in_store').click()
    const fannyRow = page
      .locator('[data-testid^="waiting-row-"]')
      .filter({ hasText: E2E_DISTRIBUTION.funded.name })
    await expect(fannyRow).toHaveCount(1)

    // Hand over Fanny's in-store order.
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    await page
      .locator('[data-testid^="distribution-member-row-"]')
      .filter({ hasText: E2E_DISTRIBUTION.funded.name })
      .click()
    const inStoreOrder = page.locator('[data-testid^="distribution-order-"]').last()
    await inStoreOrder.getByTestId('handover-submit').click()
    await expect(page.getByTestId('handover-receipt')).toBeVisible()

    await page.goto('/distribution')
    await page.getByTestId('waiting-tab-in_store').click()
    // The other members' in-store orders are still listed; only Fanny's has gone.
    await expect(page.locator('[data-testid^="waiting-row-"]').first()).toBeVisible()
    await expect(fannyRow).toHaveCount(0)
  })

  test('filtre par date de commande', async ({ page }) => {
    await page.goto('/distribution')
    await page.getByTestId('waiting-tab-pre_order').click()
    await expect(page.locator('[data-testid^="waiting-row-"]').first()).toBeVisible()

    // Everything was seeded today, so a window that ends yesterday empties the list.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    await page.getByTestId('waiting-placed-to').fill(yesterday)
    await expect(page.getByTestId('waiting-empty')).toBeVisible()
  })
})
