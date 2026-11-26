import type { Page } from '@playwright/test'
import { E2E_ORDER_MAIL } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'
import { clearMailbox, readAttachmentText, readMessagesTo } from '../maildev'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
  await clearMailbox()
})

async function aggregateFor(page: Page, supplierName: string) {
  await page.goto('/admin/catalog')
  await page.getByTestId('catalog-tab-suppliers').click()
  await page.getByTestId(`supplier-row-${supplierName}`).getByTestId('supplier-aggregate').click()
  await expect(page.getByTestId('page-supplier-order-detail')).toBeVisible()
}

test('« Envoyer » envoie la commande par e-mail au fournisseur, avec le CSV, et le détail dit comment', async ({
  page,
}) => {
  await aggregateFor(page, E2E_ORDER_MAIL.supplierName)
  await page.getByTestId('supplier-order-send').click()

  await expect(page.getByText(`Commande envoyée à ${E2E_ORDER_MAIL.supplierEmail}.`)).toBeVisible()
  await expect(page.getByTestId('supplier-order-status')).toHaveText('Envoyée')
  await expect(page.getByTestId('supplier-order-sent-how')).toHaveText(
    `Envoyée à la main à ${E2E_ORDER_MAIL.supplierEmail}`,
  )

  const [mail] = await readMessagesTo(E2E_ORDER_MAIL.supplierEmail)
  expect(mail.subject).toContain(E2E_ORDER_MAIL.supplierName)
  expect(mail.cc?.map((recipient) => recipient.address)).toEqual([E2E_ORDER_MAIL.referentEmail])
  expect(mail.text).toContain(E2E_ORDER_MAIL.productName)
  expect(mail.attachments).toHaveLength(1)
  const csv = await readAttachmentText(mail, 0)
  expect(csv).toContain(E2E_ORDER_MAIL.productName)
})

test('une commande déjà partie toute seule le dit sur son détail', async ({ page }) => {
  await page.goto('/admin/purchasing')
  await page.getByTestId('supplier-orders-tab-sent').click()
  const row = page.locator('[data-testid^="supplier-orders-row-"]', {
    hasText: E2E_ORDER_MAIL.supplierName,
  })
  await row.getByTestId('supplier-orders-row-open').click()

  await expect(page.getByTestId('supplier-order-sent-how')).toHaveText(
    `Envoyée automatiquement à ${E2E_ORDER_MAIL.supplierEmail}`,
  )
})

test('un fournisseur sans adresse : la commande est marquée envoyée et la page dit qu’aucun e-mail n’est parti', async ({
  page,
}) => {
  await aggregateFor(page, 'Fournisseur Achats E2E')
  await page.getByTestId('supplier-order-send').click()

  await expect(
    page.getByText("Aucun e-mail n'est parti : le fournisseur n'a pas d'adresse."),
  ).toBeVisible()
  await expect(page.getByTestId('supplier-order-sent-how')).toHaveText(
    "Envoyée à la main. Aucun e-mail n'est parti (pas d'adresse fournisseur)",
  )
})
