import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

async function openFirstSeededProduct(page: import('@playwright/test').Page) {
  await page.goto('/admin/catalog')
  await page.getByTestId('product-row-Pommes Golden').getByTestId('product-row-open').click()
  await expect(page.getByTestId('page-product-detail')).toBeVisible()
}

test('créer un produit à l’unité', async ({ page }) => {
  const name = `Produit unité ${Date.now()}`
  await page.goto('/admin/catalog')
  await page.getByTestId('products-new').click()

  await page.getByTestId('product-form-name').fill(name)
  await page.getByTestId('product-form-supplier').selectOption({ label: 'Ferme des Prés' })
  await page.getByTestId('product-form-category').selectOption({ label: 'Fruits & légumes' })
  await page.getByTestId('product-form-salemode-unit').click()
  await page.getByTestId('product-form-price').fill('1.50')
  await page.getByTestId('product-form-submit').click()

  await expect(page.getByTestId('page-product-detail')).toBeVisible()
  await expect(page.getByTestId('product-detail-name')).toHaveText(name)
  await expect(page.getByTestId('product-current-price')).toContainText('1.50')
  await expect(page.getByTestId('product-current-price')).toContainText('pièce')
})

test('créer un produit au poids (au kg)', async ({ page }) => {
  const name = `Produit poids ${Date.now()}`
  await page.goto('/admin/catalog')
  await page.getByTestId('products-new').click()

  await page.getByTestId('product-form-name').fill(name)
  await page.getByTestId('product-form-supplier').selectOption({ label: 'Ferme des Prés' })
  await page.getByTestId('product-form-category').selectOption({ label: 'Fruits & légumes' })
  await page.getByTestId('product-form-salemode-weight').click()
  await page.getByTestId('product-form-price').fill('3.00')
  await page.getByTestId('product-form-submit').click()

  await expect(page.getByTestId('product-current-price')).toContainText('3.00')
  await expect(page.getByTestId('product-current-price')).toContainText('kg')
})

test('changer le prix fait grandir l’historique', async ({ page }) => {
  await openFirstSeededProduct(page)
  await expect(page.getByTestId('product-price-history-item')).toHaveCount(1)

  await page.getByTestId('product-price-open').click()
  await page.getByTestId('product-price-amount').fill('9.99')
  await page.getByTestId('product-price-confirm').click()

  await expect(page.getByTestId('product-price-history-item')).toHaveCount(2)
  await expect(page.getByTestId('product-current-price')).toContainText('9.99')
})

test('archiver puis restaurer un produit', async ({ page }) => {
  await openFirstSeededProduct(page)
  const url = page.url()

  await page.getByTestId('product-detail-archive-toggle').click()
  await expect(page.getByTestId('product-archived-badge')).toBeVisible()

  // Absent de la liste (qui exclut les archivés).
  await page.goto('/admin/catalog')
  await expect(page.getByTestId('product-row-Pommes Golden')).toHaveCount(0)

  // Restaurer depuis la fiche.
  await page.goto(url)
  await page.getByTestId('product-detail-archive-toggle').click()
  await expect(page.getByTestId('product-archived-badge')).toHaveCount(0)
})

test('éditer le nom : mode de vente verrouillé', async ({ page }) => {
  await openFirstSeededProduct(page)
  const renamed = `Pommes renommées ${Date.now()}`

  await page.getByTestId('product-detail-edit').click()
  await expect(page.getByTestId('page-product-form')).toBeVisible()
  await expect(page.getByTestId('product-form-salemode-locked')).toBeVisible()

  await page.getByTestId('product-form-name').fill(renamed)
  await page.getByTestId('product-form-submit').click()

  await expect(page.getByTestId('product-detail-name')).toHaveText(renamed)
})
