import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  renderMembershipEndedEmail,
  renderMembershipRejectedEmail,
  renderNegativeBalanceAdminEmail,
  renderMissedDistributionEmail,
  renderNegativeBalanceMemberEmail,
  renderSupplierOrderEmail,
  renderSupplierOrderSendFailedEmail,
  renderUnderpaidTopupAdminEmail,
} from '../email-templates'
import { emailSamples } from '../templates/email-samples'
import { EMAIL_CATALOGUE } from './email-catalogue'

const ENGLISH_WORDS = /\b(hello|your|please|reason)\b/i

function extractHrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll('&amp;', '&'))
}

describe('e-mail templates', () => {
  it('lists the same templates as the templates folder', () => {
    const files = readdirSync(join(__dirname, '..', 'templates'))
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => file.replace(/\.tsx$/, ''))
      .sort()

    expect(EMAIL_CATALOGUE.map((entry) => entry.name).sort()).toEqual(files)
  })

  describe.each(EMAIL_CATALOGUE)('$name', (entry) => {
    it('renders a subject, an HTML version and a text version', async () => {
      const actualMail = await entry.render()

      expect(actualMail.subject.length).toBeGreaterThan(0)
      expect(actualMail.html).toContain('<html')
      expect(actualMail.text.length).toBeGreaterThan(0)
    })

    it('holds no English word of the old mails', async () => {
      const actualMail = await entry.render()

      expect(actualMail.subject).not.toMatch(ENGLISH_WORDS)
      expect(actualMail.text).not.toMatch(ENGLISH_WORDS)
      expect(actualMail.html).not.toMatch(ENGLISH_WORDS)
    })

    it('has every link of the HTML in the text', async () => {
      const actualMail = await entry.render()

      for (const href of extractHrefs(actualMail.html)) {
        expect(actualMail.text).toContain(href)
      }
      for (const link of entry.links) {
        expect(actualMail.html).toContain(link)
        expect(actualMail.text).toContain(link)
      }
    })

    it('shows the logo in the HTML only, when the mail carries it', async () => {
      const actualMail = await entry.render()

      if (entry.carriesLogo) {
        expect(actualMail.html).toContain('cid:logo@grocery')
      } else {
        expect(actualMail.html).not.toContain('cid:')
      }
      expect(actualMail.text).not.toContain('cid:')
    })

    it('shows the cooperative name in the text', async () => {
      const actualMail = await entry.render()

      expect(actualMail.text).toContain("Lay'picerie")
    })
  })

  describe('membership mails', () => {
    it('escapes a name and a reason typed by a person', async () => {
      const actualMail = await renderMembershipRejectedEmail({
        name: '<b>Mia</b>',
        reason: '<script>x</script>',
      })

      expect(actualMail.html).toContain('&lt;b&gt;')
      expect(actualMail.html).toContain('&lt;script&gt;')
      expect(actualMail.html).not.toContain('<b>Mia')
      expect(actualMail.html).not.toContain('<script>')
    })

    it.each([
      ['rejected', renderMembershipRejectedEmail],
      ['ended', renderMembershipEndedEmail],
    ])('shows the reason of the %s mail only when given', async (_name, render) => {
      const actualWithReason = await render({ name: 'Mia', reason: 'Dossier incomplet' })
      const actualWithoutReason = await render({ name: 'Mia' })

      expect(actualWithReason.text).toContain('Motif : Dossier incomplet')
      expect(actualWithReason.html).toContain('Dossier incomplet')
      expect(actualWithoutReason.text).not.toContain('Motif')
      expect(actualWithoutReason.html).not.toContain('Motif')
    })
  })

  describe('wallet notices', () => {
    it('shows the negative balance in both versions', async () => {
      const actualMail = await renderNegativeBalanceAdminEmail({
        memberName: 'Mia Dupont',
        membershipNumber: '42',
        balanceCents: -500,
      })

      expect(actualMail.html).toContain('-5,00 €')
      expect(actualMail.text).toContain('-5,00 €')
      expect(actualMail.text).toContain('adhérent n° 42')
    })

    it('shows both amounts and the top-up of an underpaid top-up in both versions', async () => {
      const actualMail = await renderUnderpaidTopupAdminEmail({
        memberName: 'Mia Dupont',
        membershipNumber: '42',
        requestedCents: 2000,
        paidCents: 1500,
        topupId: 'topup-42',
      })

      for (const version of [actualMail.html, actualMail.text]) {
        expect(version).toContain('15,00 €')
        expect(version).toContain('20,00 €')
        expect(version).toContain('topup-42')
      }
    })

    it('holds no figure in the mail to the member', async () => {
      const actualMail = await renderNegativeBalanceMemberEmail({ name: 'Mia Dupont' })

      expect(actualMail.text.replace("Lay'picerie", '')).not.toMatch(/\d/)
      expect(actualMail.html).not.toContain('€')
    })

    it('escapes the name of the member', async () => {
      const actualMail = await renderNegativeBalanceAdminEmail({
        memberName: '<b>Mia</b>',
        membershipNumber: '42',
        balanceCents: -500,
      })

      expect(actualMail.html).toContain('&lt;b&gt;')
      expect(actualMail.html).not.toContain('<b>Mia')
    })
  })

  describe('purchasing mails', () => {
    const { lines } = emailSamples.supplierOrder

    it('lists every line of the order to the supplier in both versions', async () => {
      const actualMail = await renderSupplierOrderEmail({
        supplierName: 'Moulin Dupont',
        orderDay: '2 décembre 2026',
        lines,
      })

      for (const version of [actualMail.html, actualMail.text]) {
        expect(version).toContain('Farine T65 : 10 kg')
        expect(version).toContain('Œufs : 6 pièces')
        expect(version).toContain('Miel : 1 pièce')
        expect(version).toContain('2 décembre 2026')
      }
      expect(actualMail.subject).toBe("Commande de Lay'picerie — Moulin Dupont")
      expect(actualMail.text).toContain('3 lignes')
      expect(actualMail.text).toContain('fichier CSV joint')
    })

    it('escapes the supplier name and the product names', async () => {
      const actualMail = await renderSupplierOrderEmail({
        supplierName: '<b>Moulin</b>',
        orderDay: '2 décembre 2026',
        lines: [{ productName: '<i>Farine</i>', quantity: 1, unit: 'kg' }],
      })

      expect(actualMail.html).toContain('&lt;i&gt;Farine')
      expect(actualMail.html).not.toContain('<i>Farine')
      expect(actualMail.html).not.toContain('<b>Moulin')
    })

    it('escapes the supplier name in the alerts', async () => {
      const actualMail = await renderMissedDistributionEmail({
        supplierName: '<b>Moulin</b>',
        distributionDay: '4 décembre 2026',
      })

      expect(actualMail.html).toContain('&lt;b&gt;Moulin')
      expect(actualMail.html).not.toContain('<b>Moulin')
    })

    it('writes the address of the order in full in both versions of the failure alert', async () => {
      const orderUrl = 'https://app.example.org/admin/purchasing/supplier-orders/order-42'
      const actualMail = await renderSupplierOrderSendFailedEmail({
        supplierName: 'Moulin Dupont',
        orderId: 'order-42',
        orderDay: '2 décembre 2026',
        mode: 'manual',
        reason: 'mail_error',
        orderUrl,
      })

      expect(actualMail.html).toContain(orderUrl)
      expect(actualMail.text).toContain(orderUrl)
      expect(actualMail.text).toContain('Voir la commande')
      expect(actualMail.text).toContain('à la main')
      expect(actualMail.text).toContain("le serveur d'e-mail a refusé le message")
      expect(actualMail.text).not.toContain("pas d'adresse e-mail")
    })
  })
})
