import type { Page } from '@playwright/test'
import { E2E, E2E_USERS } from '../env'
import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb }) => {
  await resetDb()
})

/** Les comptes de connexion : jamais mutés (résilier révoque leurs sessions partagées). */
const LOGIN_EMAILS = new Set<string>(Object.values(E2E_USERS))

/**
 * Id du premier adhérent « filler » d'un statut donné (ni admin, ni compte de connexion),
 * via l'API (cookie admin partagé).
 */
async function memberIdByStatus(page: Page, status: string): Promise<string> {
  const res = await page.request.get(`${E2E.apiUrl}/api/admin/members?offset=0&pageSize=50`)
  expect(res.ok(), await res.text()).toBeTruthy()
  const rows = (await res.json()).data as {
    id: string
    email: string | null
    status: string
    roles: string[]
  }[]
  const match = rows.find(
    (row) =>
      row.status === status &&
      !row.roles.includes('admin') &&
      !(row.email && LOGIN_EMAILS.has(row.email)),
  )
  if (!match) throw new Error(`aucun adhérent filler au statut ${status}`)
  return match.id
}

test('valider un adhérent en attente le passe actif', async ({ page }) => {
  const id = await memberIdByStatus(page, 'pending')
  await page.goto(`/admin/members/${id}`)
  await expect(page.getByTestId('member-status-pending')).toBeVisible()

  await page.getByTestId('member-validate').click()
  await expect(page.getByTestId('member-status-active')).toBeVisible()
})

test('refuser un adhérent en attente avec un motif', async ({ page }) => {
  const id = await memberIdByStatus(page, 'pending')
  await page.goto(`/admin/members/${id}`)

  await page.getByTestId('member-reject-open').click()
  await page.getByTestId('member-reject-reason').fill('Dossier incomplet')
  await page.getByTestId('member-reject-confirm').click()
  await expect(page.getByTestId('member-status-rejected')).toBeVisible()
})

test('nommer puis retirer un administrateur', async ({ page }) => {
  const id = await memberIdByStatus(page, 'active')
  await page.goto(`/admin/members/${id}`)

  await page.getByTestId('member-toggle-admin').click()
  await expect(page.getByTestId('member-roles')).toContainText('admin')

  await page.getByTestId('member-toggle-admin').click()
  await expect(page.getByTestId('member-roles')).not.toContainText('admin')
})

test('éditer le profil d’un adhérent', async ({ page }) => {
  const id = await memberIdByStatus(page, 'active')
  await page.goto(`/admin/members/${id}`)

  await page.getByTestId('member-edit-open').click()
  await page.getByTestId('member-edit-name').fill('Nom Édité E2E')
  await page.getByTestId('member-edit-city').fill('Rennes')
  await page.getByTestId('member-edit-save').click()

  await page.reload()
  await page.getByTestId('member-edit-open').click()
  await expect(page.getByTestId('member-edit-name')).toHaveValue('Nom Édité E2E')
  await expect(page.getByTestId('member-edit-city')).toHaveValue('Rennes')
})

test('fixer la cotisation attendue puis enregistrer un paiement', async ({ page }) => {
  const id = await memberIdByStatus(page, 'active')
  await page.goto(`/admin/members/${id}`)

  await page.getByTestId('member-fee-expected').fill('25')
  await page.getByTestId('member-fee-save').click()
  await expect(page.getByTestId('member-fee-summary')).toContainText('/ 25.00')

  await page.getByTestId('member-fee-record-open').click()
  await page.getByTestId('member-fee-amount').fill('10')
  await page.getByTestId('member-fee-record-confirm').click()
  await expect(page.getByTestId('member-fee-summary')).toContainText('10.00 / 25.00')
})

test('résilier puis réactiver un adhérent', async ({ page }) => {
  const id = await memberIdByStatus(page, 'active')
  await page.goto(`/admin/members/${id}`)

  await page.getByTestId('member-terminate-open').click()
  await page.getByTestId('member-terminate-reason').fill('Déménagement')
  await page.getByTestId('member-terminate-confirm').click()
  await expect(page.getByTestId('member-status-terminated')).toBeVisible()

  await page.getByTestId('member-reactivate').click()
  await expect(page.getByTestId('member-status-active')).toBeVisible()
})
