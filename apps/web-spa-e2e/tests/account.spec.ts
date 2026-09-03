import { E2E_PASSWORD, E2E_USERS } from '../env'
import { expect, test, withRole } from '../fixtures'
import { resetSeed } from '../reset'

test.describe('adhérent actif', () => {
  test.use(withRole('member'))
  test.afterAll(resetSeed)

  test('affiche le statut et la cotisation', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('page-account')).toBeVisible()
    await expect(page.getByTestId('account-status')).toHaveText('Actif')
  })

  test('éditer le profil et persister au reload', async ({ page }) => {
    await page.goto('/account')
    await page.getByTestId('account-name').fill('Milo Édité')
    await page.getByTestId('account-field-city').fill('Bordeaux')
    await page.getByTestId('account-save').click()

    await page.reload()
    await expect(page.getByTestId('account-name')).toHaveValue('Milo Édité')
    await expect(page.getByTestId('account-field-city')).toHaveValue('Bordeaux')
  })
})

test.describe('changement de mot de passe', () => {
  test.afterAll(resetSeed)

  test('changer le mot de passe (puis le remettre)', async ({ page }) => {
    // Compte dédié `pwtest@e2e.local` : `changePassword` fait tourner le jeton de session,
    // ce qui invaliderait un `storageState` partagé.
    await page.goto('/login')
    await page.getByTestId('auth-login-identifier').fill(E2E_USERS.pwtest)
    await page.getByTestId('auth-login-password').fill(E2E_PASSWORD)
    await page.getByTestId('auth-login-submit').click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto('/account')
    await page.getByTestId('account-password-current').fill(E2E_PASSWORD)
    await page.getByTestId('account-password-new').fill('Temp12345!')
    await page.getByTestId('account-password-submit').click()
    await expect(page.getByTestId('account-password-current')).toHaveValue('')

    await page.getByTestId('account-password-current').fill('Temp12345!')
    await page.getByTestId('account-password-new').fill(E2E_PASSWORD)
    await page.getByTestId('account-password-submit').click()
    await expect(page.getByTestId('account-password-new')).toHaveValue('')
  })
})

test.describe('adhérent en attente', () => {
  test.use(withRole('pending'))

  test('voit le message « adhésion en attente »', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByTestId('account-not-active')).toBeVisible()
  })
})

test.describe('résiliation', () => {
  test.afterAll(resetSeed)

  test('résilier son adhésion déconnecte', async ({ page }) => {
    // Compte dédié `resign@e2e.local` : la résiliation révoque toutes ses sessions.
    await page.goto('/login')
    await page.getByTestId('auth-login-identifier').fill(E2E_USERS.resign)
    await page.getByTestId('auth-login-password').fill(E2E_PASSWORD)
    await page.getByTestId('auth-login-submit').click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto('/account')
    await page.getByTestId('account-end-open').click()
    await page.getByTestId('account-end-confirm').click()

    await expect(page).toHaveURL(/\/login/)
  })
})
