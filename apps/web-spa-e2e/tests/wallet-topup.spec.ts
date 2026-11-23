import { E2E } from '../env'
import { expect, test, withRole } from '../fixtures'
import { notifyPayment, settlePayment } from '../payments'

test.describe('recharge en ligne, le formulaire', () => {
  test.use(withRole('member'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test('les montants rapides remplissent le champ, puis un montant saisi à la main', async ({
    page,
  }) => {
    await page.goto('/account')
    await expect(page.getByTestId('wallet-topup-form')).toBeVisible()

    await page.getByTestId('wallet-topup-quick-20').click()
    await expect(page.getByTestId('wallet-topup-amount')).toHaveValue('20')

    await page.getByTestId('wallet-topup-quick-50').click()
    await expect(page.getByTestId('wallet-topup-amount')).toHaveValue('50')

    await page.getByTestId('wallet-topup-amount').fill('35')
    await expect(page.getByTestId('wallet-topup-amount')).toHaveValue('35')
  })

  test('un montant trop bas est refusé avec un message', async ({ page }) => {
    await page.goto('/account')
    await page.getByTestId('wallet-topup-amount').fill('3')
    await page.getByTestId('wallet-topup-submit').click()

    await expect(page.getByTestId('wallet-topup-error')).toContainText('minimum')
    await expect(page.getByTestId('page-account')).toBeVisible()
  })

  test('un montant trop haut est refusé avec un message', async ({ page }) => {
    await page.goto('/account')
    await page.getByTestId('wallet-topup-amount').fill('250')
    await page.getByTestId('wallet-topup-submit').click()

    await expect(page.getByTestId('wallet-topup-error')).toContainText('maximum')
    await expect(page.getByTestId('page-account')).toBeVisible()
  })
})

test.describe('recharge en ligne, adhérent en attente', () => {
  test.use(withRole('pending'))

  test("n'a pas de formulaire de recharge", async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('account-not-active')).toBeVisible()
    await expect(page.getByTestId('wallet-topup-form')).toHaveCount(0)
  })
})

test.describe('recharge en ligne, le parcours', () => {
  test.use(withRole('member'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test('payer : vérification en cours, puis compte crédité avec le solde', async ({ page }) => {
    await page.goto('/account')
    await page.getByTestId('wallet-topup-quick-20').click()
    await page.getByTestId('wallet-topup-submit').click()

    await expect(page.getByTestId('page-topup-return')).toBeVisible()
    await expect(page.getByTestId('topup-return-checking')).toBeVisible()
    await expect(page.getByTestId('topup-return-balance')).toHaveCount(0)

    await settlePayment({ status: 'paid', providerPaymentId: 'pay-journey', paidAmountCents: 2000 })
    await page.getByTestId('topup-return-check-again').click()

    await expect(page.getByTestId('topup-return-credited')).toBeVisible()
    await expect(page.getByTestId('topup-return-balance')).toContainText('20.00')

    await page.goto('/account')
    await expect(page.getByTestId('wallet-balance')).toContainText('20.00')
    const entries = page.locator('[data-testid^="wallet-entry-"]')
    await expect(entries).toHaveCount(1)
    await expect(entries.first()).toContainText('Recharge en ligne')
    await expect(entries.first()).toContainText('En ligne')
  })

  test('la notification arrive avant le retour : une seule écriture', async ({ page }) => {
    const started = await page.request.post(`${E2E.apiUrl}/api/me/topups`, {
      data: { amountEur: 20 },
    })
    expect(started.ok(), await started.text()).toBeTruthy()
    const topup = (await started.json()) as { id: string }

    await settlePayment({ status: 'paid', providerPaymentId: 'pay-early', paidAmountCents: 2000 })
    await notifyPayment()

    await page.goto(`/account/topup/return?topup=${topup.id}`)
    await expect(page.getByTestId('topup-return-credited')).toBeVisible()

    await page.goto('/account')
    await expect(page.locator('[data-testid^="wallet-entry-"]')).toHaveCount(1)
    await expect(page.getByTestId('wallet-balance')).toContainText('20.00')
  })

  test("un paiement refusé montre l'échec, sans écriture, et on peut recommencer", async ({
    page,
  }) => {
    await page.goto('/account')
    await page.getByTestId('wallet-topup-quick-10').click()
    await page.getByTestId('wallet-topup-submit').click()
    await expect(page.getByTestId('topup-return-checking')).toBeVisible()

    await settlePayment({ status: 'failed' })
    await page.getByTestId('topup-return-check-again').click()

    await expect(page.getByTestId('topup-return-failed')).toBeVisible()
    await expect(page.getByTestId('topup-return-balance')).toHaveCount(0)

    await page.getByTestId('topup-return-retry').click()
    await expect(page.getByTestId('page-account')).toBeVisible()
    await expect(page.locator('[data-testid^="wallet-entry-"]')).toHaveCount(0)
    await expect(page.getByTestId('wallet-balance')).toContainText('0.00')

    await page.getByTestId('wallet-topup-quick-20').click()
    await page.getByTestId('wallet-topup-submit').click()
    await expect(page.getByTestId('topup-return-checking')).toBeVisible()
  })
})
