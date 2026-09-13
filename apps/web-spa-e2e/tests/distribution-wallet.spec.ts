import { E2E_DISTRIBUTION } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

type Page = import('@playwright/test').Page

async function openMember(page: Page, name: string) {
  await page.goto('/distribution')
  await page.getByTestId('distribution-member-search').fill(name)
  await page
    .locator('[data-testid^="distribution-member-row-"]')
    .filter({ hasText: name })
    .click()
  await expect(page.getByTestId('page-distribution-member')).toBeVisible()
}

/** US4 — the balance, the movements behind it, and taking payment at the table. */
test.describe('compte adhérent, côté table', () => {
  test.use(withRole('distributor'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test('refuse la remise, encaisse le manque, puis valide', async ({ page }) => {
    await openMember(page, E2E_DISTRIBUTION.broke.name)
    const order = page.locator('[data-testid^="distribution-order-"]').first()

    // Zero balance against a 6 € order.
    await order.getByTestId('handover-submit').click()
    await expect(page.getByTestId('handover-refusal')).toContainText('solde')

    // Record what the member hands over, then validate again (SC-011).
    await page.getByTestId('wallet-record-payment').click()
    await page.getByTestId('wallet-payment-amount').fill('10')
    await page.getByTestId('wallet-payment-method-cash').click()
    await page.getByTestId('wallet-payment-submit').click()
    await expect(page.getByTestId('distribution-member-balance')).toContainText('10')

    await order.getByTestId('handover-submit').click()
    await expect(page.getByTestId('handover-receipt')).toBeVisible()
    await expect(page.getByTestId('distribution-member-balance')).toContainText('4')
  })

  test('enregistre un chèque et un virement, chacun avec son moyen', async ({ page }) => {
    await openMember(page, E2E_DISTRIBUTION.broke.name)

    for (const [method, amount] of [
      ['cheque', '15'],
      ['transfer', '25'],
    ] as const) {
      await page.getByTestId('wallet-record-payment').click()
      await page.getByTestId('wallet-payment-amount').fill(amount)
      await page.getByTestId(`wallet-payment-method-${method}`).click()
      await page.getByTestId('wallet-payment-submit').click()
    }

    await expect(page.getByTestId('distribution-member-balance')).toContainText('40')
    await expect(page.getByTestId('wallet-history')).toContainText('15')
    await expect(page.getByTestId('wallet-history')).toContainText('25')
  })
})

test.describe('compte adhérent, côté adhérent', () => {
  test.use(withRole('member'))

  test('voit son solde et ses mouvements sur son compte', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('wallet-panel')).toBeVisible()
    await expect(page.getByTestId('wallet-balance')).toBeVisible()
  })
})
