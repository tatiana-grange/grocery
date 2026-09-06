import { expect, test, withRole } from '../fixtures'

test.use(withRole('member'))

test('la session survit à un reload et à une nouvelle page', async ({ page, context }) => {
  await page.goto('/shop')
  await expect(page.getByTestId('page-shop')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('page-shop')).toBeVisible()

  const other = await context.newPage()
  await other.goto('/account')
  await expect(other.getByTestId('page-account')).toBeVisible()
  await other.close()
})
