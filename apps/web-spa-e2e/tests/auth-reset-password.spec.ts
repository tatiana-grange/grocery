import { clearMailbox, readResetPasswordToken } from '../maildev'
import { E2E_USERS } from '../env'
import { expect, test } from '../fixtures'

/**
 * Parcours complet mot de passe oublié → mail (maildev) → réinitialisation → reconnexion.
 * Utilise `pending@e2e.local` : changer son mot de passe n'impacte aucune autre spec
 * (les specs authentifiées rejouent un cookie, pas le mot de passe).
 */
const NEW_PASSWORD = 'Reset1234!'

test('oublié → lien maildev → nouveau mot de passe → reconnexion', async ({ page }) => {
  await clearMailbox()

  await page.goto('/forgot-password')
  await page.getByTestId('auth-forgot-identifier').fill(E2E_USERS.pending)
  await page.getByTestId('auth-forgot-submit').click()
  await expect(page.getByTestId('auth-forgot-sent')).toBeVisible()

  const token = await readResetPasswordToken(E2E_USERS.pending)

  await page.goto(`/reset-password?token=${token}`)
  await expect(page.getByTestId('page-reset-password')).toBeVisible()
  await page.getByTestId('auth-reset-password').fill(NEW_PASSWORD)
  await page.getByTestId('auth-reset-confirm').fill(NEW_PASSWORD)
  await page.getByTestId('auth-reset-submit').click()

  await expect(page).toHaveURL(/\/login/)

  await page.getByTestId('auth-login-identifier').fill(E2E_USERS.pending)
  await page.getByTestId('auth-login-password').fill(NEW_PASSWORD)
  await page.getByTestId('auth-login-submit').click()
  await expect(page).toHaveURL(/\/dashboard/)
})
