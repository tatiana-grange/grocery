import { E2E } from '../env'
import { expect, test, withRole } from '../fixtures'

/**
 * Smoke de navigation : chaque route rend son `page-<nom>` et **pas** le
 * `route-error-boundary` de `root.tsx`. Aucune assertion métier — le filet pas cher qui
 * attrape un loader cassé, une route mal câblée ou un import qui plante.
 */
test.use(withRole('admin'))

// Ce smoke lit l'id d'une entité seedée réelle : il lui faut la baseline complète, quel que
// soit l'ordre d'exécution (une spec précédente peut avoir archivé tout le catalogue).
test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

test('toutes les routes rendent leur contenu propre', async ({ page }) => {
  // Ids dynamiques : on prend une entité seedée réelle via l'API (cookie admin partagé).
  const membersRes = await page.request.get(`${E2E.apiUrl}/api/admin/members?offset=0&pageSize=1`)
  expect(membersRes.ok(), await membersRes.text()).toBeTruthy()
  const members = (await membersRes.json()).data as { id: string }[]
  expect(members.length, 'la baseline seedée doit contenir au moins un adhérent').toBeGreaterThan(0)
  const memberId = members[0].id

  const productsRes = await page.request.get(`${E2E.apiUrl}/api/admin/products`)
  expect(productsRes.ok(), await productsRes.text()).toBeTruthy()
  const products = (await productsRes.json()).data as { id: string }[]
  expect(products.length, 'la baseline seedée doit contenir au moins un produit').toBeGreaterThan(0)
  const productId = products[0].id

  const routes: { path: string; testId: string }[] = [
    { path: '/dashboard', testId: 'page-dashboard-home' },
    { path: '/components', testId: 'page-components' },
    { path: '/dashboard/profile', testId: 'page-profile' },
    { path: '/account', testId: 'page-account' },
    { path: '/admin/members', testId: 'page-members-list' },
    { path: `/admin/members/${memberId}`, testId: 'page-member-detail' },
    { path: '/admin/catalog', testId: 'page-catalog' },
    { path: '/admin/catalog/products/new', testId: 'page-product-form' },
    { path: `/admin/catalog/products/${productId}`, testId: 'page-product-detail' },
    { path: `/admin/catalog/products/${productId}/edit`, testId: 'page-product-form' },
  ]

  for (const { path, testId } of routes) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(page.getByTestId('route-error-boundary')).toHaveCount(0)
      await expect(page.getByTestId(testId)).toBeVisible()
    })
  }
})
