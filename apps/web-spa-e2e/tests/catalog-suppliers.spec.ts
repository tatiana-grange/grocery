import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb, page }) => {
  await resetDb()
  await page.goto('/admin/catalog')
  await page.getByTestId('catalog-tab-suppliers').click()
})

test('créer un fournisseur', async ({ page }) => {
  const name = `Fournisseur E2E ${Date.now()}`
  await page.getByTestId('supplier-new').click()
  await page.getByTestId('supplier-name').fill(name)
  await page.getByTestId('supplier-type-wholesaler').click()
  await page.getByTestId('supplier-save').click()

  const row = page.getByTestId(`supplier-row-${name}`)
  await expect(row).toBeVisible()
  await expect(row.getByTestId('supplier-row-type')).toHaveText('Grossiste')
})

test('renommer un fournisseur', async ({ page }) => {
  const renamed = `Ferme renommée ${Date.now()}`
  await page.getByTestId('supplier-row-Ferme des Prés').getByTestId('supplier-edit').click()
  await page.getByTestId('supplier-name').fill(renamed)
  await page.getByTestId('supplier-save').click()

  await expect(page.getByTestId(`supplier-row-${renamed}`)).toBeVisible()
})

test('archiver un fournisseur sans produit le retire de la liste', async ({ page }) => {
  await page.getByTestId('supplier-row-Grossiste Bio Sud').getByTestId('supplier-archive').click()
  await expect(page.getByTestId('supplier-row-Grossiste Bio Sud')).toHaveCount(0)
})

test('archivage bloqué tant qu’il reste des produits actifs → cascade', async ({ page }) => {
  // "Ferme des Prés" porte 2 produits actifs seedés : l'archivage demande confirmation.
  page.on('dialog', (dialog) => dialog.accept())

  await page.getByTestId('supplier-row-Ferme des Prés').getByTestId('supplier-archive').click()
  await expect(page.getByTestId('supplier-row-Ferme des Prés')).toHaveCount(0)

  // La cascade a aussi archivé ses produits.
  await page.getByTestId('catalog-tab-products').click()
  await expect(page.getByTestId('product-row-Pommes Golden')).toHaveCount(0)
})
