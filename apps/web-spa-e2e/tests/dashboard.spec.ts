import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test('accueil : salutation avec le nom de la personne connectée', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByTestId('dashboard-home-greeting')).toContainText('Ada Admin')
})

test('profil : email, statut de vérification et identifiant', async ({ page }) => {
  await page.goto('/dashboard/profile')
  await expect(page.getByTestId('profile-email')).toHaveText('admin@e2e.local')
  await expect(page.getByTestId('profile-email-verified')).toHaveText('Vérifié')
  await expect(page.getByTestId('profile-user-id')).not.toHaveText('—')
})

test('palette de commandes : ouvre et navigue', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByTestId('dashboard-command-trigger').click()
  await expect(page.getByTestId('command-palette-input')).toBeVisible()

  await page.getByTestId('command-item-components').click()
  await expect(page).toHaveURL(/\/components/)
  await expect(page.getByTestId('page-components')).toBeVisible()
})

test('bascule de thème', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByTestId('dashboard-user-menu').click()
  await page.getByTestId('dashboard-menu-theme').click()
  await expect(page.locator('body')).toHaveClass(/dark/)
})

test('changement de langue fr → en', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByTestId('dashboard-user-menu').click()
  await page.getByTestId('dashboard-lang-trigger').click()
  await page.getByTestId('dashboard-lang-en').click()
  await expect(page.getByTestId('dashboard-home-greeting')).toContainText('Welcome')
})
