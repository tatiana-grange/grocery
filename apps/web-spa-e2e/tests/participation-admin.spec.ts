import { E2E_PARTICIPATION, E2E_USER_NAMES } from '../env'
import { expect, newRolePage, test, withRole } from '../fixtures'
import {
  createApiContextAs,
  findMySignup,
  findSlotCard,
  findSlotIdByLabel,
  signUpAs,
} from '../participation'

type Page = import('@playwright/test').Page

const DAY_MS = 24 * 60 * 60 * 1000
/**
 * The first name only: the profile journey renames the seeded member, and the reset keeps the
 * account tables, so the last name depends on which spec ran first.
 */
const MEMBER_FIRST_NAME = E2E_USER_NAMES.member.split(' ')[0]!

function slotRow(page: Page, roleLabel: string) {
  return page.locator('[data-testid^="slot-row-"]').filter({ hasText: roleLabel })
}

/** `yyyy-mm-dd` in the browser's own zone, which is what a date input holds. */
function localDate(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * DAY_MS)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** A slot that ended yesterday. Only the API can make one: the form starts from today. */
async function createPastSlot(roleLabel: string) {
  const api = await createApiContextAs('admin')
  const startsAt = new Date(Date.now() - 2 * DAY_MS)
  const response = await api.post('/api/admin/slots', {
    data: {
      roleLabel,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + DAY_MS).toISOString(),
      places: 2,
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  await api.dispose()
}

async function openDetail(page: Page, roleLabel: string) {
  await page.goto('/admin/slots')
  await slotRow(page, roleLabel).getByTestId('row-open').click()
  await expect(page.getByTestId('page-slot-detail')).toBeVisible()
}

test.describe('participation, côté administrateur', () => {
  test.use(withRole('admin'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  test("l'admin crée un créneau, l'adhérent le voit et s'y inscrit, puis l'admin voit l'inscrit", async ({
    page,
    browser,
  }) => {
    const roleLabel = 'Mise en rayon E2E'
    await page.goto('/admin/slots')
    await expect(page.getByTestId('page-slots-list')).toBeVisible()

    await page.getByTestId('slots-new').click()
    await page.getByTestId('slot-form-role').fill(roleLabel)
    await page.getByTestId('slot-form-date').fill(localDate(15))
    await page.getByTestId('slot-form-start').fill('10:00')
    await page.getByTestId('slot-form-end').fill('12:00')
    await page.getByTestId('slot-form-places').fill('2')
    await page.getByTestId('slot-form-submit').click()

    const row = slotRow(page, roleLabel)
    await expect(row).toBeVisible()
    await expect(row.getByTestId('row-count')).toContainText('0 / 2')

    const member = await newRolePage(browser, 'member')
    await member.page.goto('/participation')
    await findSlotCard(member.page, roleLabel).getByTestId('slot-signup').click()
    await expect(findMySignup(member.page, roleLabel)).toBeVisible()
    await member.context.close()

    await openDetail(page, roleLabel)
    await expect(page.getByTestId('slot-detail-signups')).toContainText(MEMBER_FIRST_NAME)
  })

  test("l'admin retire un adhérent à moins de 7 jours du début, ce que l'adhérent ne pouvait pas faire", async ({
    page,
  }) => {
    const { roleLabel } = E2E_PARTICIPATION.threeDay
    await signUpAs('member', await findSlotIdByLabel(roleLabel))

    await openDetail(page, roleLabel)
    const signups = page.getByTestId('slot-detail-signups')
    await expect(signups).toContainText(MEMBER_FIRST_NAME)

    await signups.getByTestId('signup-remove').click()

    await expect(signups).not.toContainText(MEMBER_FIRST_NAME)
    await expect(page.getByTestId('slot-detail-count')).toContainText('0 / 3')
  })

  test("l'admin ne peut pas supprimer un créneau qui a des inscrits, il l'annule", async ({
    page,
    browser,
  }) => {
    const { roleLabel } = E2E_PARTICIPATION.tenDay
    const slotId = await findSlotIdByLabel(roleLabel)
    await signUpAs('member', slotId)

    await openDetail(page, roleLabel)
    await expect(page.getByTestId('slot-detail-delete')).toHaveCount(0)

    await page.getByTestId('slot-detail-cancel').click()
    await expect(page.getByTestId('cancel-slot-warning')).toBeVisible()
    await page.getByTestId('cancel-slot-confirm').click()
    await expect(page.getByTestId('slot-detail-cancelled')).toBeVisible()

    const member = await newRolePage(browser, 'member')
    await member.page.goto('/participation')
    const mine = member.page.locator(`[data-testid="my-signup-${slotId}"]`)
    await expect(mine).toBeVisible()
    await expect(mine.getByTestId('signup-cancelled-badge')).toBeVisible()
    await expect(member.page.locator(`[data-testid="slot-card-${slotId}"]`)).toHaveCount(0)
    await member.context.close()
  })

  test("l'admin supprime un créneau sans inscrit", async ({ page }) => {
    const { roleLabel } = E2E_PARTICIPATION.twelveDay
    await openDetail(page, roleLabel)

    await page.getByTestId('slot-detail-delete').click()
    await page.getByTestId('delete-slot-confirm').click()

    await expect(page.getByTestId('page-slots-list')).toBeVisible()
    await expect(slotRow(page, roleLabel)).toHaveCount(0)
  })

  test("l'admin inscrit un adhérent depuis la fiche du créneau", async ({ page, browser }) => {
    const { roleLabel } = E2E_PARTICIPATION.twelveDay
    await openDetail(page, roleLabel)

    await page.getByTestId('slot-detail-add-member').click()
    await page.getByTestId('add-member-search').fill(MEMBER_FIRST_NAME)
    await page
      .locator('[data-testid^="add-member-option-"]')
      .filter({ hasText: MEMBER_FIRST_NAME })
      .click()

    await expect(page.getByTestId('slot-detail-signups')).toContainText(MEMBER_FIRST_NAME)

    const member = await newRolePage(browser, 'member')
    await member.page.goto('/participation')
    await expect(findMySignup(member.page, roleLabel)).toBeVisible()
    await member.context.close()
  })

  test("l'admin modifie le rôle et les places d'un créneau", async ({ page }) => {
    const { roleLabel } = E2E_PARTICIPATION.twelveDay
    const renamed = 'Accueil E2E'
    await openDetail(page, roleLabel)

    await page.getByTestId('slot-detail-edit').click()
    await page.getByTestId('slot-form-role').fill(renamed)
    await page.getByTestId('slot-form-places').fill('5')
    await page.getByTestId('slot-form-submit').click()

    await expect(page.getByTestId('slot-form-dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: renamed })).toBeVisible()
    await expect(page.getByTestId('slot-detail-count')).toContainText('0 / 5')
  })

  test("l'admin ne voit les créneaux passés qu'avec le bouton prévu", async ({ page }) => {
    const pastLabel = 'Créneau passé E2E'
    await createPastSlot(pastLabel)
    await page.goto('/admin/slots')
    await expect(page.getByTestId('page-slots-list')).toBeVisible()
    await expect(slotRow(page, pastLabel)).toHaveCount(0)

    await page.getByTestId('slots-show-past').click()

    await expect(slotRow(page, pastLabel)).toBeVisible()
  })

  test("l'admin ne peut pas descendre les places sous le nombre d'inscrits", async ({ page }) => {
    const { roleLabel } = E2E_PARTICIPATION.tenDay
    const slotId = await findSlotIdByLabel(roleLabel)
    await signUpAs('member', slotId)
    await signUpAs('admin', slotId)

    await openDetail(page, roleLabel)
    await page.getByTestId('slot-detail-edit').click()

    // With sign-ups, the day and the times are locked; the places are not.
    await expect(page.getByTestId('slot-form-date')).toBeDisabled()
    await expect(page.getByTestId('slot-form-start')).toBeDisabled()
    await expect(page.getByTestId('slot-form-end')).toBeDisabled()

    await page.getByTestId('slot-form-places').fill('1')
    await page.getByTestId('slot-form-submit').click()
    await expect(page.getByTestId('slot-form-error')).toContainText('inscrits')
    await expect(page.getByTestId('slot-form-dialog')).toBeVisible()
  })
})
