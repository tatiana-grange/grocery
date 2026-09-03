import { expect, test, withRole } from '../fixtures'

test.use(withRole('member'))

test('la session survit à un reload et à une nouvelle page', async ({ page, context }) => {
  await page.goto('/dashboard')
  await expect(page.getByTestId('page-dashboard-home')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('page-dashboard-home')).toBeVisible()

  const other = await context.newPage()
  await other.goto('/dashboard/profile')
  await expect(other.getByTestId('page-profile')).toBeVisible()
  await other.close()
})
