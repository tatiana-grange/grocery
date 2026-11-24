import { request } from '@playwright/test'
import { E2E, E2E_PARTICIPATION, storageStatePath } from '../env'
import { expect, test, withRole } from '../fixtures'

type Page = import('@playwright/test').Page

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function slotCard(page: Page, roleLabel: string) {
  return page.locator('[data-testid^="slot-card-"]').filter({ hasText: roleLabel })
}

function mySignup(page: Page, roleLabel: string) {
  return page.locator('[data-testid^="my-signup-"]').filter({ hasText: roleLabel })
}

/** A request context signed in as the admin, to set up data the member screen then shows. */
async function adminApi() {
  return request.newContext({
    baseURL: E2E.apiUrl,
    storageState: storageStatePath('admin'),
  })
}

async function slotIdByLabel(roleLabel: string): Promise<string> {
  const api = await adminApi()
  const response = await api.get('/api/admin/slots?offset=0&pageSize=50')
  expect(response.ok(), await response.text()).toBeTruthy()
  const slots = (await response.json()).data as { id: string; roleLabel: string }[]
  await api.dispose()
  const slot = slots.find((candidate) => candidate.roleLabel === roleLabel)
  expect(slot, `le créneau « ${roleLabel} » doit être seedé`).toBeDefined()
  return slot!.id
}

test.describe('participation, côté adhérent', () => {
  test.use(withRole('member'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test("un adhérent s'inscrit à un créneau, le voit dans sa liste, puis s'en désinscrit", async ({
    page,
  }) => {
    const { roleLabel } = E2E_PARTICIPATION.tenDay
    await page.goto('/participation')
    await expect(page.getByTestId('page-participation')).toBeVisible()

    const card = slotCard(page, roleLabel)
    await expect(card.getByTestId('slot-places')).toContainText('2 places')
    await expect(page.getByTestId('my-signups-empty')).toBeVisible()

    await card.getByTestId('slot-signup').click()

    await expect(mySignup(page, roleLabel)).toBeVisible()
    await expect(card.getByTestId('slot-places')).toContainText('1 place')
    await expect(card.getByTestId('slot-signup')).toBeDisabled()
    await expect(card.getByTestId('slot-signup')).toContainText('inscrit')

    // The slot is ten days out, so leaving is still allowed.
    const row = mySignup(page, roleLabel)
    await expect(row.getByTestId('signup-leave')).toBeEnabled()
    await row.getByTestId('signup-leave').click()
    await page.getByTestId('leave-confirm').click()

    await expect(mySignup(page, roleLabel)).toHaveCount(0)
    await expect(card.getByTestId('slot-places')).toContainText('2 places')
    await expect(card.getByTestId('slot-signup')).toBeEnabled()
  })

  test('un adhérent ne peut plus se désinscrire à moins de 7 jours du début', async ({ page }) => {
    const { roleLabel } = E2E_PARTICIPATION.threeDay
    await page.goto('/participation')

    await slotCard(page, roleLabel).getByTestId('slot-signup').click()

    const row = mySignup(page, roleLabel)
    await expect(row).toBeVisible()
    await expect(row.getByTestId('signup-leave')).toBeDisabled()
    await expect(row.getByTestId('signup-deadline')).toContainText("jusqu'au")
  })

  test('un créneau qui chevauche une inscription existante est refusé avec une phrase claire', async ({
    page,
  }) => {
    const start = Date.now() + 20 * DAY_MS
    const api = await adminApi()
    for (const [roleLabel, from, to] of [
      ['Chevauchement A', start, start + 2 * HOUR_MS],
      ['Chevauchement B', start + HOUR_MS, start + 3 * HOUR_MS],
    ] as const) {
      const response = await api.post('/api/admin/slots', {
        data: {
          roleLabel,
          startsAt: new Date(from).toISOString(),
          endsAt: new Date(to).toISOString(),
          places: 2,
        },
      })
      expect(response.ok(), await response.text()).toBeTruthy()
    }
    await api.dispose()

    await page.goto('/participation')
    await slotCard(page, 'Chevauchement A').getByTestId('slot-signup').click()
    await expect(mySignup(page, 'Chevauchement A')).toBeVisible()

    await slotCard(page, 'Chevauchement B').getByTestId('slot-signup').click()
    await expect(page.getByText('chevauche').first()).toBeVisible()
    await expect(mySignup(page, 'Chevauchement B')).toHaveCount(0)
    await expect(slotCard(page, 'Chevauchement B').getByTestId('slot-signup')).toBeEnabled()
  })

  test('un créneau complet affiche « Complet » et son bouton est désactivé', async ({ page }) => {
    const { roleLabel } = E2E_PARTICIPATION.twelveDay
    const slotId = await slotIdByLabel(roleLabel)

    // The admin is a member too: they take the one place.
    const api = await adminApi()
    const signedUp = await api.post(`/api/me/slots/${slotId}/signup`)
    expect(signedUp.ok(), await signedUp.text()).toBeTruthy()
    await api.dispose()

    await page.goto('/participation')
    const card = slotCard(page, roleLabel)
    await expect(card.getByTestId('slot-full')).toContainText('Complet')
    await expect(card.getByTestId('slot-signup')).toBeDisabled()
  })
})
