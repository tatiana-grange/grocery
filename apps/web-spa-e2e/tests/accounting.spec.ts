import { expect, test, withRole } from '../fixtures'

type Page = import('@playwright/test').Page

/** The rows of the expense list that hold this text. */
function expenseRow(page: Page, text: string) {
  return page.locator('[data-testid^="expense-row-"]').filter({ hasText: text })
}

test.describe('comptabilité, côté administrateur', () => {
  test.use(withRole('admin'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test("l'admin enregistre une dépense et la voit dans la liste", async ({ page }) => {
    await page.goto('/admin/accounting/expenses')
    await expect(page.getByTestId('page-expenses')).toBeVisible()

    await page.getByTestId('expenses-new').click()
    await page.getByTestId('expense-form-amount').fill('12.50')
    await page.getByTestId('expense-form-category').selectOption('insurance')
    await page.getByTestId('expense-form-label').fill('Assurance locaux E2E')
    await page.getByTestId('expense-form-method').selectOption('cheque')
    await page.getByTestId('expense-form-submit').click()

    const row = expenseRow(page, 'Assurance locaux E2E')
    await expect(row).toBeVisible()
    await expect(row).toContainText('12.50')
    await expect(row.getByTestId('expense-cancelled-badge')).toHaveCount(0)
  })

  test("l'admin annule une dépense avec un motif, elle est marquée annulée", async ({ page }) => {
    await page.goto('/admin/accounting/expenses')
    const row = expenseRow(page, 'E2E bank fees')
    await expect(row).toBeVisible()

    await row.getByTestId('expense-cancel').click()
    await expect(page.getByTestId('cancel-expense-warning')).toBeVisible()
    await page.getByTestId('cancel-expense-reason').fill('Saisie en double')
    await page.getByTestId('cancel-expense-confirm').click()

    // The cancelled expense stays in the list, marked; its reversing row sits beside it.
    await expect(
      expenseRow(page, 'E2E bank fees').filter({ has: page.getByTestId('expense-cancelled-badge') }),
    ).toHaveCount(1)
    const reversal = expenseRow(page, 'Saisie en double')
    await expect(reversal).toBeVisible()
    await expect(reversal).toContainText('-3.50')
    // A cancelled expense and a reversing row cannot be cancelled again.
    await expect(page.getByTestId('expense-cancel')).toHaveCount(1)
  })
})
