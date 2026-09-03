import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb, page }) => {
  await resetDb()
  await page.goto('/admin/catalog')
  await page.getByTestId('catalog-tab-categories').click()
})

test('créer une catégorie', async ({ page }) => {
  const name = `Catégorie E2E ${Date.now()}`
  await page.getByTestId('category-new').click()
  await page.getByTestId('category-name').fill(name)
  await page.getByTestId('category-save').click()

  await expect(page.getByTestId(`category-row-${name}`)).toBeVisible()
})

test('renommer une catégorie', async ({ page }) => {
  const name = `Catégorie E2E ${Date.now()}`
  await page.getByTestId('category-new').click()
  await page.getByTestId('category-name').fill(name)
  await page.getByTestId('category-save').click()
  await expect(page.getByTestId(`category-row-${name}`)).toBeVisible()

  const renamed = `${name} renommée`
  await page.getByTestId(`category-row-${name}`).getByTestId('category-edit').click()
  await page.getByTestId('category-name').fill(renamed)
  await page.getByTestId('category-save').click()

  await expect(page.getByTestId(`category-row-${renamed}`)).toBeVisible()
})

test('archiver une catégorie vide la retire de la liste', async ({ page }) => {
  const name = `Catégorie vide ${Date.now()}`
  await page.getByTestId('category-new').click()
  await page.getByTestId('category-name').fill(name)
  await page.getByTestId('category-save').click()

  await page.getByTestId(`category-row-${name}`).getByTestId('category-archive').click()
  await expect(page.getByTestId(`category-row-${name}`)).toHaveCount(0)
})

test('archivage bloqué quand un produit référence la catégorie', async ({ page }) => {
  // "Fruits & légumes" porte les produits seedés : l'archivage échoue, la ligne reste.
  const row = page.getByTestId('category-row-Fruits & légumes')
  await row.getByTestId('category-archive').click()

  await expect(row).toBeVisible()
  await expect(row.getByTestId('category-archive')).toBeVisible()
})
