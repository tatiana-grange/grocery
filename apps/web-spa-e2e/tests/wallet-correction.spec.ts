import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { E2E_DISTRIBUTION, E2E_USERS } from '../env'
import { expect, newRolePage, test, withRole } from '../fixtures'
import { clearMailbox, readMessagesTo } from '../maildev'

type Page = import('@playwright/test').Page

// The member sentence is read from the locale file the app renders, so the assertions follow the
// stable `wallet.negative.member` key rather than a French string copied here.
const frLocale = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../web-spa/app/lib/i18n/locales/fr/common.locales.fr.json', import.meta.url),
    ),
    'utf-8',
  ),
) as { wallet: { negative: { member: string } } }
const NEGATIVE_SENTENCE = frLocale.wallet.negative.member

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

/** One express sale of the honey (7 €), validated in one motion. */
async function sellHoney(page: Page) {
  await page.getByTestId('distribution-start-express').click()
  await expect(page.getByTestId('page-express-order')).toBeVisible()
  await page.getByTestId('express-product-search').fill(E2E_DISTRIBUTION.expressProductName)
  await page.locator('[data-testid^="express-product-option-"]').first().click()
  await page.getByTestId('express-submit').click()
}

/** Milo pays 10, buys 7 of honey, then staff correct the payment: the balance is -7. */
async function correctMiloPayment(page: Page) {
  await openMember(page, MILO)
  await recordCash(page, '10')
  await expect(page.getByTestId('distribution-member-balance')).toContainText('10')
  await sellHoney(page)
  await expect(page.getByTestId('handover-receipt')).toBeVisible()

  await openMember(page, MILO)
  await expect(page.getByTestId('distribution-member-balance')).toContainText('3')
  const payment = page
    .locator('[data-testid^="wallet-entry-"]')
    .filter({ hasText: 'Paiement reçu' })
  await payment.getByTestId('wallet-correct-open').click()
  await page.getByTestId('wallet-correct-reason').fill('Chèque sans provision')
  await page.getByTestId('wallet-correct-confirm').click()
}

test.describe('correction de paiement, côté personnel', () => {
  test.use(withRole('distributor'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
    await clearMailbox()
  })

  test('le personnel corrige un paiement et le solde devient négatif', async ({ page }) => {
    await correctMiloPayment(page)

    await expect(page.getByTestId('distribution-member-balance')).toContainText('-7')
    await expect(page.getByTestId('distribution-member-negative-notice')).toBeVisible()

    const history = page.getByTestId('wallet-history')
    await expect(history.getByText('Corrigé')).toBeVisible()
    await expect(history.getByText('Correction de paiement')).toBeVisible()
    await expect(history).toContainText('Chèque sans provision')
    await expect(history.getByTestId('wallet-correct-open')).toHaveCount(0)

    // The counter is closed to this member until the account is topped up.
    await sellHoney(page)
    await expect(page.getByTestId('express-refusal')).toBeVisible()
    await openMember(page, MILO)
    await expect(page.getByTestId('distribution-member-balance')).toContainText('-7')
  })
})

test.describe('correction de paiement, les mails', () => {
  test.use(withRole('distributor'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
    await clearMailbox()
  })

  test("l'adhérent et l'administrateur reçoivent chacun un mail, sans montant pour l'adhérent", async ({
    page,
  }) => {
    await correctMiloPayment(page)
    await expect(page.getByTestId('distribution-member-balance')).toContainText('-7')

    const toMember = await readMessagesTo(E2E_USERS.member)
    const toAdmin = await readMessagesTo(E2E_USERS.admin)

    expect(toMember).toHaveLength(1)
    expect(toAdmin).toHaveLength(1)
    expect(toMember[0]?.subject).toBe('Un problème sur votre compte')
    expect(`${toMember[0]?.text}${toMember[0]?.html}`).not.toMatch(/7[,.]00|-7/)
    expect(toAdmin[0]?.subject).toContain(MILO)
  })
})

async function addFromShop(page: Page, productName: string) {
  await page.goto('/shop')
  await page.getByTestId('shop-search').fill(productName)
  await page.getByTestId('shop-search').press('Enter')
  await page.getByTestId('shop-product-card-name').filter({ hasText: productName }).click()
  await expect(page.getByTestId('page-shop-product-detail')).toBeVisible()
  await page.getByTestId('add-to-cart-submit').click()
}

test.describe('correction de paiement, côté adhérent', () => {
  test.use(withRole('distributor'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
    await clearMailbox()
  })

  test("l'adhérent au solde négatif ne peut pas commander et voit le message", async ({
    page,
    browser,
  }) => {
    const { context: memberContext, page: member } = await newRolePage(browser, 'member')

    // While the balance is zero the member can still fill a cart.
    await addFromShop(member, 'Pommes Golden')
    await expect(member.getByTestId('site-nav-cart-count')).toHaveText('1')

    await correctMiloPayment(page)
    await expect(page.getByTestId('distribution-member-balance')).toContainText('-7')

    // The cart: the notice shows and the checkout button is disabled.
    await member.goto('/cart')
    await expect(member.getByTestId('negative-balance-notice')).toHaveText(NEGATIVE_SENTENCE)
    await expect(member.getByTestId('cart-checkout')).toBeDisabled()

    // The shop: adding is refused, and the toast carries the same text.
    await addFromShop(member, 'Panier de légumes du producteur')
    await expect(member.getByText(NEGATIVE_SENTENCE)).toBeVisible()
    await expect(member.getByTestId('site-nav-cart-count')).toHaveText('1')

    // The account page: the notice shows and the top-up form is still there.
    await member.goto('/account')
    await expect(member.getByTestId('negative-balance-notice')).toBeVisible()
    await expect(member.getByTestId('wallet-topup-form')).toBeVisible()

    // A new payment lifts the block with no other action.
    await openMember(page, MILO)
    await recordCash(page, '20')
    await expect(page.getByTestId('distribution-member-balance')).toContainText('13')
    await member.goto('/cart')
    await expect(member.getByTestId('negative-balance-notice')).toHaveCount(0)
    await expect(member.getByTestId('cart-checkout')).toBeEnabled()

    await memberContext.close()
  })
})
