import { expect, test, withRole } from '../fixtures'

test.describe('membre simple', () => {
  test.use(withRole('member'))

  test('/admin/members → panneau accès refusé', async ({ page }) => {
    await page.goto('/admin/members')
    await expect(page.getByTestId('rbac-access-denied')).toBeVisible()
    await expect(page.getByTestId('page-members-list')).toHaveCount(0)
  })

  test('/account reste accessible', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('page-account')).toBeVisible()
  })
})

test.describe('admin', () => {
  test.use(withRole('admin'))

  test('accède au back-office adhérents', async ({ page }) => {
    await page.goto('/admin/members')
    await expect(page.getByTestId('page-members-list')).toBeVisible()
    await expect(page.getByTestId('rbac-access-denied')).toHaveCount(0)
  })

  test('/account reste accessible', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('page-account')).toBeVisible()
  })
})
