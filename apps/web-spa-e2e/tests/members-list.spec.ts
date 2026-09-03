import { E2E_SEARCH_MEMBER_NAME } from '../env'
import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

test('la liste rend les adhérents seedés', async ({ page }) => {
  await page.goto('/admin/members')
  await expect(page.getByTestId('page-members-list')).toBeVisible()
  await expect(page.getByTestId('members-row-name').first()).toBeVisible()
})

test('les onglets filtrent par statut', async ({ page }) => {
  await page.goto('/admin/members')
  await expect(page.getByTestId('members-row-name').first()).toBeVisible()

  await page.getByTestId('members-tab-all').click()
  const allCount = await page.getByTestId('members-row-name').count()

  await page.getByTestId('members-tab-pending').click()
  const pendingCount = await page.getByTestId('members-row-name').count()

  await page.getByTestId('members-tab-active').click()
  const activeCount = await page.getByTestId('members-row-name').count()

  // "Tous" englobe au moins autant que chaque sous-ensemble.
  expect(allCount).toBeGreaterThanOrEqual(pendingCount)
  expect(allCount).toBeGreaterThanOrEqual(activeCount)
})

test('recherche par nom', async ({ page }) => {
  await page.goto('/admin/members')
  await expect(page.getByTestId('members-row-name').first()).toBeVisible()
  await page.getByTestId('members-tab-all').click()

  await page.getByTestId('members-search').fill(E2E_SEARCH_MEMBER_NAME)
  await page.getByTestId('members-search').press('Enter')

  await expect(page.getByTestId('members-row-name')).toHaveText(E2E_SEARCH_MEMBER_NAME)
})

test('pagination', async ({ page }) => {
  await page.goto('/admin/members')
  await expect(page.getByTestId('members-row-name').first()).toBeVisible()
  await page.getByTestId('members-tab-all').click()

  await expect(page.getByTestId('members-page-indicator')).toContainText('1 /')
  await page.getByTestId('members-page-next').click()
  await expect(page.getByTestId('members-page-indicator')).toContainText('2 /')
  await page.getByTestId('members-page-prev').click()
  await expect(page.getByTestId('members-page-indicator')).toContainText('1 /')
})

test('création d’un adhérent depuis la liste', async ({ page }) => {
  const name = `Nouvel Adhérent ${Date.now()}`
  await page.goto('/admin/members')

  await page.getByTestId('members-create-open').click()
  await page.getByTestId('members-create-name').fill(name)
  await page.getByTestId('members-create-email').fill(`nouvel-adherent-${Date.now()}@e2e.local`)
  await page.getByTestId('members-create-submit').click()

  await page.getByTestId('members-tab-all').click()
  await page.getByTestId('members-search').fill(name)
  await page.getByTestId('members-search').press('Enter')
  await expect(page.getByTestId('members-row-name')).toHaveText(name)
})
