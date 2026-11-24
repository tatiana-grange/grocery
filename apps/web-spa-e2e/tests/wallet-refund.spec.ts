import { expect, newRolePage, test, withRole } from '../fixtures'

type Page = import('@playwright/test').Page

// `account.spec.ts` renames Milo to "Milo Édité" and `resetDb` keeps the auth tables, so the
// first name is all this spec can rely on.
const MILO = 'Milo'

async function openMember(page: Page, name: string) {
  await page.goto('/distribution')
  await page.getByTestId('distribution-member-search').fill(name)
  await page.locator('[data-testid^="distribution-member-row-"]').filter({ hasText: name }).click()
  await expect(page.getByTestId('page-distribution-member')).toBeVisible()
}

async function recordCash(page: Page, amount: string) {
  await page.getByTestId('wallet-record-payment').click()
  await page.getByTestId('wallet-payment-amount').fill(amount)
  await page.getByTestId('wallet-payment-method-cash').click()
  await page.getByTestId('wallet-payment-submit').click()
}

async function refund(page: Page, amount: string, method: 'cash' | 'cheque', reason: string) {
  await page.getByTestId('wallet-refund-open').click()
  await page.getByTestId('wallet-refund-amount').fill(amount)
  await page.getByTestId(`wallet-refund-method-${method}`).click()
  await page.getByTestId('wallet-refund-reason').fill(reason)
  await page.getByTestId('wallet-refund-confirm').click()
}

test.describe('remboursement, côté administrateur', () => {
  test.use(withRole('admin'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test("l'admin rembourse une partie du solde et l'adhérent le voit", async ({ page, browser }) => {
    await openMember(page, MILO)

    // With a balance of zero there is nothing to refund.
    await expect(page.getByTestId('wallet-refund-open')).toBeDisabled()

    await recordCash(page, '30')
    await expect(page.getByTestId('distribution-member-balance')).toContainText('30')

    // An amount above the balance cannot be confirmed.
    await page.getByTestId('wallet-refund-open').click()
    await page.getByTestId('wallet-refund-amount').fill('40')
    await page.getByTestId('wallet-refund-reason').fill('Trop')
    await expect(page.getByTestId('wallet-refund-too-large')).toBeVisible()
    await expect(page.getByTestId('wallet-refund-confirm')).toBeDisabled()
    await page.getByTestId('wallet-refund-cancel').click()

    // A refund needs a reason, then it lowers the balance.
    await page.getByTestId('wallet-refund-open').click()
    await page.getByTestId('wallet-refund-amount').fill('10')
    await expect(page.getByTestId('wallet-refund-confirm')).toBeDisabled()
    await page.getByTestId('wallet-refund-cancel').click()

    await refund(page, '10', 'cash', "Départ de l'adhérent")
    await expect(page.getByTestId('distribution-member-balance')).toContainText('20')
    const history = page.getByTestId('wallet-history')
    await expect(history.getByText('Remboursement')).toBeVisible()
    await expect(history).toContainText("Départ de l'adhérent")

    // Refunding the rest leaves zero and closes the button again.
    await refund(page, '20', 'cheque', 'Solde rendu')
    await expect(page.getByTestId('distribution-member-balance')).toContainText('0.00')
    await expect(page.getByTestId('wallet-refund-open')).toBeDisabled()

    // The member sees both refunds with their reasons.
    const { context: memberContext, page: member } = await newRolePage(browser, 'member')
    await member.goto('/account')
    const memberHistory = member.getByTestId('wallet-history')
    await expect(memberHistory).toContainText("Départ de l'adhérent")
    await expect(memberHistory).toContainText('Solde rendu')
    await expect(memberHistory.getByText('Remboursement')).toHaveCount(2)
    await memberContext.close()
  })
})

test.describe('remboursement, côté distributeur', () => {
  test.use(withRole('distributor'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test('le distributeur ne voit pas le bouton de remboursement', async ({ page }) => {
    await openMember(page, MILO)
    await recordCash(page, '30')
    await expect(page.getByTestId('distribution-member-balance')).toContainText('30')

    await expect(page.getByTestId('wallet-record-payment')).toBeVisible()
    await expect(page.getByTestId('wallet-refund-open')).toHaveCount(0)
  })
})
