import { expect, test, withRole } from '../fixtures'

test.use(withRole('admin'))

test.beforeEach(async ({ resetDb, page }) => {
  await resetDb()
  await page.goto('/admin/catalog')
  await page.getByTestId('catalog-tab-suppliers').click()
})

test('l’admin règle « premier vendredi, envoi le dernier mercredi à 8 h » et voit les prochaines dates', async ({
  page,
}) => {
  const row = page.getByTestId('supplier-row-Ferme des Prés')
  await expect(row.getByTestId('supplier-next-order')).toHaveText('—')

  await row.getByTestId('supplier-schedule-edit').click()
  await page.getByTestId('schedule-enabled').click()

  // Rien n'est encore choisi : l'enregistrement est refusé et le formulaire dit ce qui manque.
  const missing = page.getByTestId('schedule-missing')
  await expect(page.getByTestId('schedule-save')).toBeDisabled()
  await expect(missing).toContainText('Fréquence')
  await expect(missing).toContainText("Heure d'envoi")

  await page.getByTestId('schedule-frequency').selectOption('monthly')
  await page.getByTestId('schedule-distribution-weekday').selectOption('5')
  await page.getByTestId('schedule-month-week').selectOption('first')
  await page.getByTestId('schedule-sending-weekday').selectOption('3')
  await expect(page.getByTestId('schedule-save')).toBeDisabled()
  await expect(missing).toContainText("Heure d'envoi")
  await expect(missing).not.toContainText('Fréquence')

  await page.getByTestId('schedule-sending-hour').selectOption('8')
  await expect(missing).toHaveCount(0)
  await page.getByTestId('schedule-save').click()

  // Le premier vendredi du mois tombe entre le 1er et le 7 ; l'envoi est un mercredi, à 8 h.
  await expect(row.getByTestId('supplier-next-order')).toHaveText(
    /^Distribution ven\. [1-7](er)? \S+ · envoi mer\. \d{1,2}(er)? \S+ à 8 h$/,
  )
})

test('l’admin renseigne l’adresse e-mail d’un fournisseur', async ({ page }) => {
  const row = page.getByTestId('supplier-row-Ferme des Prés')
  await row.getByTestId('supplier-edit').click()
  await page.getByTestId('supplier-contact-email').fill('commandes@ferme-des-pres.example')
  await page.getByTestId('supplier-save').click()
  await expect(row.getByTestId('supplier-edit')).toBeVisible()

  await row.getByTestId('supplier-edit').click()
  await expect(page.getByTestId('supplier-contact-email')).toHaveValue(
    'commandes@ferme-des-pres.example',
  )
})

test('une adresse e-mail invalide est refusée', async ({ page }) => {
  await page.getByTestId('supplier-row-Ferme des Prés').getByTestId('supplier-edit').click()
  await page.getByTestId('supplier-contact-email').fill('pas-une-adresse')

  await expect(page.getByTestId('supplier-save')).toBeDisabled()
})
