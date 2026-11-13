import { E2E_DISTRIBUTION } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

/**
 * US7 — the distributor role opens the table and nothing else. `rbac-admin.spec.ts` covers
 * the member/admin boundary and is deliberately left untouched.
 */
const ADMIN_ONLY_ROUTES = [
  '/admin/members',
  '/admin/catalog',
  '/admin/purchasing',
  '/admin/inventory',
] as const

test.describe('distributeur', () => {
  test.use(withRole('distributor'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test('atteint la table de distribution', async ({ page }) => {
    await page.goto('/distribution')
    await expect(page.getByTestId('page-distribution-home')).toBeVisible()
    await expect(page.getByTestId('rbac-access-denied')).toHaveCount(0)
  })

  test('mène une remise à son terme', async ({ page }) => {
    await page.goto('/distribution')
    await page.getByTestId('distribution-member-search').fill(E2E_DISTRIBUTION.funded.name)
    await page
      .locator('[data-testid^="distribution-member-row-"]')
      .filter({ hasText: E2E_DISTRIBUTION.funded.name })
      .click()
    await page.locator('[data-testid^="distribution-order-"]').last().getByTestId('handover-submit').click()
    await expect(page.getByTestId('handover-receipt')).toBeVisible()
  })

  for (const route of ADMIN_ONLY_ROUTES) {
    test(`est refusé sur ${route}`, async ({ page }) => {
      await page.goto(route)
      await expect(page.getByTestId('rbac-access-denied')).toBeVisible()
    })
  }

  test('garde accès à son propre compte', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('page-account')).toBeVisible()
  })
})

test.describe('membre simple', () => {
  test.use(withRole('member'))

  test('est refusé sur la table de distribution', async ({ page }) => {
    await page.goto('/distribution')
    await expect(page.getByTestId('rbac-access-denied')).toBeVisible()
    await expect(page.getByTestId('page-distribution-home')).toHaveCount(0)
  })
})

test.describe('admin', () => {
  test.use(withRole('admin'))

  test('atteint la table de distribution comme le distributeur', async ({ page }) => {
    await page.goto('/distribution')
    await expect(page.getByTestId('page-distribution-home')).toBeVisible()
  })

  test('garde le back-office', async ({ page }) => {
    await page.goto('/admin/members')
    await expect(page.getByTestId('page-members-list')).toBeVisible()
  })
})
