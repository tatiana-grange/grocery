import { E2E_DISTRIBUTION } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

type Page = import('@playwright/test').Page

test.use(withRole('distributor'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

async function handOverInStoreOrder(page: Page) {
  await page.goto('/distribution')
  await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
  await page
    .locator('[data-testid^="distribution-member-row-"]')
    .filter({ hasText: E2E_DISTRIBUTION.funded.name })
    .click()
  await page.locator('[data-testid^="distribution-order-"]').last().getByTestId('handover-submit').click()
  await expect(page.getByTestId('handover-receipt')).toBeVisible()
  await page.getByTestId('handover-receipt-link').click()
  await expect(page.getByTestId('page-handover-receipt')).toBeVisible()
}

/** US6 — undo a validated handover without editing anything. */
test.describe('annulation d’une remise', () => {
  test('recrédite l’adhérent et laisse les deux écritures visibles', async ({ page }) => {
    await handOverInStoreOrder(page)
    // 60 € − 7 € (the seeded in-store order) = 53 €.
    await expect(page.getByTestId('handover-total')).toContainText('7')

    await page.getByTestId('handover-reverse').click()
    await page.getByTestId('handover-reverse-reason').fill('Mauvais adhérent')
    await page.getByTestId('handover-reverse-confirm').click()

    await expect(page.getByTestId('page-handover-receipt')).toContainText('Annul')

    // Back at the member: the balance is whole again and both entries are in the history.
    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    await page
      .locator('[data-testid^="distribution-member-row-"]')
      .filter({ hasText: E2E_DISTRIBUTION.funded.name })
      .click()
    await expect(page.getByTestId('distribution-member-balance')).toContainText('60')
    await expect(page.getByTestId('wallet-history')).toContainText('-7')
    await expect(page.getByTestId('wallet-history')).toContainText('7')
  })

  test('remet la commande en attente, prête à être remise à nouveau', async ({ page }) => {
    await handOverInStoreOrder(page)
    await page.getByTestId('handover-reverse').click()
    await page.getByTestId('handover-reverse-reason').fill('Erreur de saisie')
    await page.getByTestId('handover-reverse-confirm').click()
    await expect(page.getByTestId('page-handover-receipt')).toContainText('Annul')

    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    await page
      .locator('[data-testid^="distribution-member-row-"]')
      .filter({ hasText: E2E_DISTRIBUTION.funded.name })
      .click()
    // Both orders are outstanding again.
    await expect(page.locator('[data-testid^="distribution-order-"]')).toHaveCount(2)
  })

  test('refuse une deuxième annulation', async ({ page }) => {
    await handOverInStoreOrder(page)
    await page.getByTestId('handover-reverse').click()
    await page.getByTestId('handover-reverse-reason').fill('Doublon')
    await page.getByTestId('handover-reverse-confirm').click()
    await expect(page.getByTestId('page-handover-receipt')).toContainText('Annul')

    // The action is gone once the handover is reversed.
    await expect(page.getByTestId('handover-reverse')).toHaveCount(0)
  })
})
