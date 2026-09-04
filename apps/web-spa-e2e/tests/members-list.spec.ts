import type { Page } from '@playwright/test'
import { E2E_SEARCH_MEMBER_NAME } from '../env'
import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

/**
 * Nombre de lignes une fois la liste stabilisée. react-query vide `data` le temps d'un
 * refetch (changement d'onglet vers une clé non mise en cache), donc pendant ce laps le
 * tableau montre les squelettes — un `.count()` immédiat lit `0`. On attend deux lectures
 * consécutives identiques et non nulles (chaque filtre du seed a au moins un adhérent).
 */
async function settledRowCount(page: Page): Promise<number> {
  const rows = page.getByTestId('members-row-name')
  let previous = -1
  await expect
    .poll(async () => {
      const current = await rows.count()
      const settled = current > 0 && current === previous
      previous = current
      return settled
    })
    .toBe(true)
  return previous
}

test('la liste rend les adhérents seedés', async ({ page }) => {
  await page.goto('/admin/members')
  await expect(page.getByTestId('page-members-list')).toBeVisible()
  await expect(page.getByTestId('members-row-name').first()).toBeVisible()
})

test('les onglets filtrent par statut', async ({ page }) => {
  await page.goto('/admin/members')
  await expect(page.getByTestId('members-row-name').first()).toBeVisible()

  await page.getByTestId('members-tab-all').click()
  const allCount = await settledRowCount(page)

  await page.getByTestId('members-tab-pending').click()
  const pendingCount = await settledRowCount(page)

  await page.getByTestId('members-tab-active').click()
  const activeCount = await settledRowCount(page)

  // "Tous" englobe au moins autant que chaque sous-ensemble (plafonné à la taille de page).
  expect(allCount).toBeGreaterThanOrEqual(pendingCount)
  expect(allCount).toBeGreaterThanOrEqual(activeCount)
})

test('recherche par nom', async ({ page }) => {
  await page.goto('/admin/members')
  await expect(page.getByTestId('members-row-name').first()).toBeVisible()

  // Zelda est active : sans repasser sur "Tous", le filtre statut="pending" la masque.
  await page.getByTestId('members-tab-all').click()
  await expect(page.getByTestId('members-row-name').first()).toBeVisible()

  await page.getByTestId('members-search').fill(E2E_SEARCH_MEMBER_NAME)
  await page.getByTestId('members-search').press('Enter')

  // `toHaveCount` réessaie pendant que la liste filtrée se charge (20 → 1).
  await expect(page.getByTestId('members-row-name')).toHaveCount(1)
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
  const stamp = Date.now()
  const name = `Nouvel Adhérent ${stamp}`
  await page.goto('/admin/members')

  await page.getByTestId('members-create-open').click()
  await page.getByTestId('members-create-name').fill(name)
  await page.getByTestId('members-create-email').fill(`nouvel-adherent-${stamp}@e2e.local`)
  await page.getByTestId('members-create-submit').click()
  await expect(page.getByTestId('members-create-name')).toBeHidden()

  // Le nouvel adhérent est actif : on le retrouve via "Tous" + recherche.
  await page.getByTestId('members-tab-all').click()
  await expect(page.getByTestId('members-row-name').first()).toBeVisible()
  await page.getByTestId('members-search').fill(name)
  await page.getByTestId('members-search').press('Enter')

  await expect(page.getByTestId('members-row-name')).toHaveCount(1)
  await expect(page.getByTestId('members-row-name')).toHaveText(name)
})
