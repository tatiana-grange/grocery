import { expect, test } from '../fixtures'

/** Validation des formulaires d'auth (aucun storageState). */
test('inscription : mots de passe différents → erreur de confirmation', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByTestId('page-register')).toBeVisible()

  await page.getByTestId('auth-register-name').fill('Test Personne')
  await page.getByTestId('auth-register-identifier').fill('nouvelle@e2e.local')
  await page.getByTestId('auth-register-password').fill('Password123!')
  await page.getByTestId('auth-register-confirm').fill('DifferentPass1!')
  await page.getByTestId('auth-register-submit').click()

  await expect(page.getByTestId('auth-register-confirm-error')).toBeVisible()
  await expect(page).toHaveURL(/\/register/)
})

test('inscription : email invalide bloque la soumission', async ({ page }) => {
  await page.goto('/register')
  await page.getByTestId('auth-register-name').fill('Test Personne')
  await page.getByTestId('auth-register-identifier').fill('pas-un-email')
  await page.getByTestId('auth-register-password').fill('Password123!')
  await page.getByTestId('auth-register-confirm').fill('Password123!')
  await page.getByTestId('auth-register-submit').click()

  await expect(page).toHaveURL(/\/register/)
  await expect(page.getByTestId('page-register')).toBeVisible()
})

test('mot de passe oublié : la soumission affiche la confirmation', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page.getByTestId('page-forgot-password')).toBeVisible()

  await page.getByTestId('auth-forgot-identifier').fill('member@e2e.local')
  await page.getByTestId('auth-forgot-submit').click()

  await expect(page.getByTestId('auth-forgot-sent')).toBeVisible()
})
