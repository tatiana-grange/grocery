import { readFile } from 'node:fs/promises'
import { E2E } from '../env'
import { expect, newRolePage, test, withRole } from '../fixtures'

type Page = import('@playwright/test').Page

function expenseRow(page: Page, text: string) {
  return page.locator('[data-testid^="expense-row-"]').filter({ hasText: text })
}

/** Records one expense through the screen. The day is today, which is the form's default. */
async function recordExpenseOnScreen(
  page: Page,
  expense: { amount: string; category: string; label: string; method?: string },
): Promise<void> {
  await page.goto('/admin/accounting/expenses')
  await page.getByTestId('expenses-new').click()
  await page.getByTestId('expense-form-amount').fill(expense.amount)
  await page.getByTestId('expense-form-category').selectOption(expense.category)
  await page.getByTestId('expense-form-label').fill(expense.label)
  if (expense.method) await page.getByTestId('expense-form-method').selectOption(expense.method)
  await page.getByTestId('expense-form-submit').click()
  await expect(expenseRow(page, expense.label)).toBeVisible()
}

test.describe('comptabilité, côté administrateur', () => {
  test.use(withRole('admin'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test("l'admin enregistre une dépense et la voit dans la liste", async ({ page }) => {
    await recordExpenseOnScreen(page, {
      amount: '12.50',
      category: 'insurance',
      label: 'Assurance locaux E2E',
      method: 'cheque',
    })

    const row = expenseRow(page, 'Assurance locaux E2E')
    await expect(row).toBeVisible()
    await expect(row).toContainText('12.50')
    await expect(row.getByTestId('expense-cancelled-badge')).toHaveCount(0)
  })

  test("la remise à zéro n'écrit aucune annulation dans les comptes", async ({ page }) => {
    await page.goto('/admin/accounting/expenses')
    await expect(expenseRow(page, 'E2E rent')).toBeVisible()
    await expect(expenseRow(page, 'E2E bank fees')).toBeVisible()

    await expect(page.getByTestId('expense-reason')).toHaveCount(0)
    await expect(page.getByTestId('expense-cancelled-badge')).toHaveCount(0)
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
      expenseRow(page, 'E2E bank fees').filter({
        has: page.getByTestId('expense-cancelled-badge'),
      }),
    ).toHaveCount(1)
    const reversal = expenseRow(page, 'Saisie en double')
    await expect(reversal).toBeVisible()
    await expect(reversal).toContainText('-3.50')
    // A cancelled expense and a reversing row cannot be cancelled again.
    await expect(page.getByTestId('expense-cancel')).toHaveCount(1)
  })

  test("l'admin lit le compte de résultat de l'année et la dépense apparaît dans sa catégorie", async ({
    page,
  }) => {
    // The seeded books: a rent of 450.00 and bank fees of 3.50, a membership fee of 10.00, no sale.
    await page.goto('/admin/accounting')
    await expect(page.getByTestId('page-profit-and-loss')).toBeVisible()
    await expect(page.getByTestId('pnl-sales')).toHaveText('0.00 €')
    await expect(page.getByTestId('pnl-fees')).toHaveText('10.00 €')
    await expect(page.getByTestId('pnl-expense-rent')).toHaveText('450.00 €')
    await expect(page.getByTestId('pnl-expense-insurance')).toHaveText('0.00 €')
    await expect(page.getByTestId('pnl-expenses-total')).toHaveText('453.50 €')
    await expect(page.getByTestId('pnl-result')).toHaveText('-443.50 €')

    await page.getByTestId('pnl-to-expenses').click()
    await expect(page.getByTestId('page-expenses')).toBeVisible()
    await recordExpenseOnScreen(page, {
      amount: '20',
      category: 'insurance',
      label: 'Assurance annuelle E2E',
    })
    await page.getByTestId('expenses-to-profit-and-loss').click()

    await expect(page.getByTestId('page-profit-and-loss')).toBeVisible()
    await expect(page.getByTestId('pnl-expense-insurance')).toHaveText('20.00 €')
    await expect(page.getByTestId('pnl-expenses-total')).toHaveText('473.50 €')
    await expect(page.getByTestId('pnl-result')).toHaveText('-463.50 €')
  })

  test("l'admin change la période du compte de résultat, l'adresse la garde", async ({ page }) => {
    await page.goto('/admin/accounting')
    await expect(page.getByTestId('pnl-expenses-total')).toHaveText('453.50 €')

    await page.getByTestId('period-from').fill('2020-01-01')
    await page.getByTestId('period-to').fill('2020-12-31')

    await expect(page.getByTestId('pnl-expenses-total')).toHaveText('0.00 €')
    await expect(page.getByTestId('pnl-fees')).toHaveText('0.00 €')
    await expect(page).toHaveURL(/[?&]from=2020-01-01&to=2020-12-31/)
  })

  test("l'admin télécharge les cinq exports, chacun avec son nom et son en-tête", async ({
    page,
  }) => {
    const headers: Record<string, string> = {
      'wallet-movements':
        'date,recordedAt,entryId,membershipNumber,memberName,reason,paymentMethod,amountEur,handoverId,note',
      sales:
        'date,recordedAt,handoverId,kind,reversesHandoverId,membershipNumber,memberName,product,quantity,unitPriceEur,lineTotalEur,costOfGoodsEur',
      purchases:
        'date,recordedAt,receptionId,supplierOrderId,supplier,product,receivedQuantity,unitCostEur,lineTotalEur',
      'membership-fees':
        'date,recordedAt,paymentId,membershipNumber,memberName,kind,method,amountEur,note',
      expenses:
        'date,expenseId,kind,cancelsExpenseId,category,label,paymentMethod,amountEur,reason,recordedBy,recordedAt',
    }
    await page.goto('/admin/accounting')
    await expect(page.getByTestId('page-profit-and-loss')).toBeVisible()
    const year = new Date().getFullYear()

    for (const [exportName, header] of Object.entries(headers)) {
      const downloadPromise = page.waitForEvent('download')
      await page.getByTestId(`export-${exportName}`).click()
      const download = await downloadPromise

      expect(download.suggestedFilename()).toBe(
        `grocery-${exportName}-${year}-01-01-${year}-12-31.csv`,
      )
      const lines = (await readFile(await download.path(), 'utf8')).split('\r\n')
      expect(lines[0], exportName).toBe(header)
    }
  })

  test("l'admin télécharge l'export des dépenses", async ({ page }) => {
    await recordExpenseOnScreen(page, {
      amount: '8.40',
      category: 'other',
      label: 'Papeterie E2E',
    })
    await page.goto('/admin/accounting')
    await expect(page.getByTestId('page-profit-and-loss')).toBeVisible()

    const year = new Date().getFullYear()
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('export-expenses').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe(`grocery-expenses-${year}-01-01-${year}-12-31.csv`)
    const path = await download.path()
    const lines = (await readFile(path, 'utf8')).split('\r\n')
    expect(lines[0]).toBe(
      'date,expenseId,kind,cancelsExpenseId,category,label,paymentMethod,amountEur,reason,recordedBy,recordedAt',
    )
    const row = lines.find((line) => line.includes('Papeterie E2E'))
    expect(row, 'the expense just recorded is in the file').toBeDefined()
    expect(row).toContain(',expense,')
    expect(row).toContain(',other,Papeterie E2E,transfer,8.40,')
    // The two seeded expenses are in the file too.
    expect(
      lines.filter((line) => line.includes('E2E rent') || line.includes('E2E bank fees')),
    ).toHaveLength(2)
  })
})

test("un adhérent et un distributeur n'atteignent pas les écrans de comptabilité", async ({
  browser,
}) => {
  for (const role of ['member', 'distributor'] as const) {
    await test.step(role, async () => {
      const { context, page } = await newRolePage(browser, role)
      for (const path of ['/admin/accounting', '/admin/accounting/expenses']) {
        await page.goto(path)
        await expect(page.getByTestId('rbac-access-denied')).toBeVisible()
        await expect(page.getByTestId('page-profit-and-loss')).toHaveCount(0)
        await expect(page.getByTestId('page-expenses')).toHaveCount(0)
      }
      // The server refuses too, whatever the screen shows.
      const answer = await context.request.get(
        `${E2E.apiUrl}/api/admin/accounting/exports/expenses?from=2026-01-01&to=2026-12-31`,
      )
      expect(answer.status()).toBe(403)
      await context.close()
    })
  }
})
