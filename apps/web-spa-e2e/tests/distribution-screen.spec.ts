import { E2E_DISTRIBUTION } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

test.use(withRole('distributor'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

/** US1 — find a member at the table and see everything waiting for them. */
test.describe('écran de distribution', () => {
  test('trouve un adhérent par son nom', async ({ page }) => {
    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    await expect(page.getByTestId('distribution-search-results')).toContainText(
      E2E_DISTRIBUTION.funded.name,
    )
  })

  test('trouve le même adhérent par son numéro', async ({ page }) => {
    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    const row = page
      .locator('[data-testid^="distribution-member-row-"]')
      .filter({ hasText: E2E_DISTRIBUTION.funded.name })
    const membershipNumber = (await row.getByTestId('member-number').textContent())?.trim() ?? ''
    expect(membershipNumber).not.toBe('')

    await page.getByTestId('distribution-member-search').fill(membershipNumber)
    await expect(page.getByTestId('distribution-search-results')).toContainText(
      E2E_DISTRIBUTION.funded.name,
    )
  })

  test('montre les commandes, le solde et les lignes prêtes', async ({ page }) => {
    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    await page
      .locator('[data-testid^="distribution-member-row-"]')
      .filter({ hasText: E2E_DISTRIBUTION.funded.name })
      .click()

    await expect(page.getByTestId('page-distribution-member')).toBeVisible()
    // 60 € seeded as an opening transfer.
    await expect(page.getByTestId('distribution-member-balance')).toContainText('60')
    // One received pre-order and one in-store order.
    await expect(page.locator('[data-testid^="distribution-order-"]')).toHaveCount(2)
    await expect(page.getByTestId('distribution-line-not-ready')).toHaveCount(0)
    // The checkout snapshot price, and the shelf quantity beside what was ordered.
    await expect(page.getByTestId('page-distribution-member')).toContainText(
      E2E_DISTRIBUTION.readyProductName,
    )
  })

  test('signale une précommande dont les marchandises ne sont pas arrivées', async ({ page }) => {
    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.awaiting.name)
    await page
      .locator('[data-testid^="distribution-member-row-"]')
      .filter({ hasText: E2E_DISTRIBUTION.awaiting.name })
      .click()

    await expect(page.getByTestId('distribution-line-not-ready').first()).toBeVisible()
    await expect(page.getByTestId('distribution-line-not-ready').first()).toContainText(
      'livraison',
    )
    // The order itself is flagged not ready; refusing the handover is asserted in
    // distribution-handover.spec.ts, which is where the form lives.
    await expect(page.getByTestId('order-readiness-not-ready').first()).toBeVisible()
  })

  test('annonce qu’il n’y a rien à retirer, sans fermer la commande express', async ({ page }) => {
    await page.goto('/distribution')
    // Dina herself has no outstanding order.
    await page.getByTestId('distribution-member-search').fill('Dina')
    await page.locator('[data-testid^="distribution-member-row-"]').first().click()

    await expect(page.getByTestId('distribution-nothing-to-collect')).toBeVisible()
    await expect(page.getByTestId('distribution-start-express')).toBeVisible()
  })
})
