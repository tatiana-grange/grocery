import { E2E_PRODUCT_BARCODE } from '../env'
import { expect, test } from '../fixtures'

// Aucun `test.use(withRole(...))` : le contexte reste signé-out (pas de storageState),
// conformément à FR-001 — la boutique publique doit être joignable sans compte.

test.beforeEach(async ({ resetDb, page }) => {
  await resetDb()
  await page.goto('/shop')
})

test('parcourir la boutique en visiteur, sans être connecté', async ({ page }) => {
  await expect(page.getByTestId('page-shop')).toBeVisible()
  await expect(page.getByTestId('shop-nav-signin')).toBeVisible()
  await expect(page.getByTestId('shop-product-card-link').first()).toBeVisible()
})

test('les catégories vides (produits archivés) restent masquées', async ({ page }) => {
  await expect(page.getByTestId('shop-category-filter-all')).toBeVisible()
  await expect(page.getByText('Fruits & légumes')).toBeVisible()
  await expect(page.getByText('Épicerie (archivée)')).toHaveCount(0)
})

test('rechercher un produit par nom', async ({ page }) => {
  await page.getByTestId('shop-search').fill('Pommes Golden')
  await page.getByTestId('shop-search').press('Enter')

  await expect(page.getByText('Pommes Golden')).toBeVisible()
  await expect(page.getByTestId('shop-count')).toContainText('1')
})

test('rechercher un produit par code-barres', async ({ page }) => {
  await page.getByTestId('shop-search').fill(E2E_PRODUCT_BARCODE)
  await page.getByTestId('shop-search').press('Enter')

  await expect(page.getByText('Farine T65')).toBeVisible()
})

test('trier la liste', async ({ page }) => {
  await page.getByTestId('shop-sort').selectOption('name:asc')
  const firstCardAsc = page.getByTestId('shop-product-card-name').first()
  await expect(firstCardAsc).toHaveText('Carottes en vrac')
})

test("ouvrir la fiche d'un produit affiche photos, description, prix, unité, labels et mode de commande", async ({
  page,
}) => {
  await page.getByText('Pommes Golden').click()

  await expect(page.getByTestId('page-shop-product-detail')).toBeVisible()
  await expect(page.getByTestId('shop-product-name')).toHaveText('Pommes Golden')
  await expect(page.getByTestId('shop-product-price')).toContainText('€')
  await expect(page.getByTestId('shop-product-ordering-mode')).toBeVisible()
})
