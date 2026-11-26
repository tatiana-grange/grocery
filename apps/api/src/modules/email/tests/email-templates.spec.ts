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
import { EMAIL_CATALOGUE } from './email-catalogue'

const ENGLISH_WORDS = /\b(hello|your|please|reason)\b/i

function hrefsOf(html: string): string[] {
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
      const mail = await entry.render()

      expect(mail.subject.length).toBeGreaterThan(0)
      expect(mail.html).toContain('<html')
      expect(mail.text.length).toBeGreaterThan(0)
    })

    it('holds no English word of the old mails', async () => {
      const mail = await entry.render()

      expect(mail.subject).not.toMatch(ENGLISH_WORDS)
      expect(mail.text).not.toMatch(ENGLISH_WORDS)
      expect(mail.html).not.toMatch(ENGLISH_WORDS)
    })

    it('has every link of the HTML in the text', async () => {
      const mail = await entry.render()

      for (const href of hrefsOf(mail.html)) {
        expect(mail.text).toContain(href)
      }
      for (const link of entry.links) {
        expect(mail.html).toContain(link)
        expect(mail.text).toContain(link)
      }
    })

    it('shows the logo in the HTML only, when the mail carries it', async () => {
      const mail = await entry.render()

      if (entry.carriesLogo) {
        expect(mail.html).toContain('cid:logo@grocery')
      } else {
        expect(mail.html).not.toContain('cid:')
      }
      expect(mail.text).not.toContain('cid:')
    })

    it('shows the cooperative name in the text', async () => {
      const mail = await entry.render()

      expect(mail.text).toContain("Lay'picerie")
    })
  })

  describe('membership mails', () => {
    it('escapes a name and a reason typed by a person', async () => {
      const mail = await renderMembershipRejectedEmail({
        name: '<b>Mia</b>',
        reason: '<script>x</script>',
      })

      expect(mail.html).toContain('&lt;b&gt;')
      expect(mail.html).toContain('&lt;script&gt;')
      expect(mail.html).not.toContain('<b>Mia')
      expect(mail.html).not.toContain('<script>')
    })

    it.each([
      ['rejected', renderMembershipRejectedEmail],
      ['ended', renderMembershipEndedEmail],
    ])('shows the reason of the %s mail only when given', async (_name, render) => {
      const withReason = await render({ name: 'Mia', reason: 'Dossier incomplet' })
      const withoutReason = await render({ name: 'Mia' })

      expect(withReason.text).toContain('Motif : Dossier incomplet')
      expect(withReason.html).toContain('Dossier incomplet')
      expect(withoutReason.text).not.toContain('Motif')
      expect(withoutReason.html).not.toContain('Motif')
    })
  })

  describe('wallet notices', () => {
    it('shows the negative balance in both versions', async () => {
      const mail = await renderNegativeBalanceAdminEmail({
        memberName: 'Mia Dupont',
        membershipNumber: '42',
        balanceCents: -500,
      })

      expect(mail.html).toContain('-5,00 €')
      expect(mail.text).toContain('-5,00 €')
      expect(mail.text).toContain('adhérent n° 42')
    })

    it('shows both amounts and the top-up of an underpaid top-up in both versions', async () => {
      const mail = await renderUnderpaidTopupAdminEmail({
        memberName: 'Mia Dupont',
        membershipNumber: '42',
        requestedCents: 2000,
        paidCents: 1500,
        topupId: 'topup-42',
      })

      for (const version of [mail.html, mail.text]) {
        expect(version).toContain('15,00 €')
        expect(version).toContain('20,00 €')
        expect(version).toContain('topup-42')
      }
    })

    it('holds no figure in the mail to the member', async () => {
      const mail = await renderNegativeBalanceMemberEmail({ name: 'Mia Dupont' })

      expect(mail.text.replace("Lay'picerie", '')).not.toMatch(/\d/)
      expect(mail.html).not.toContain('€')
    })

    it('escapes the name of the member', async () => {
      const mail = await renderNegativeBalanceAdminEmail({
        memberName: '<b>Mia</b>',
        membershipNumber: '42',
        balanceCents: -500,
      })

      expect(mail.html).toContain('&lt;b&gt;')
      expect(mail.html).not.toContain('<b>Mia')
    })
  })

  describe('purchasing mails', () => {
    const lines = [
      { productName: 'Farine T65', quantity: 10, unit: 'kg' },
      { productName: 'Œufs', quantity: 6, unit: 'pièces' },
      { productName: 'Miel', quantity: 1, unit: 'pièce' },
    ]

    it('lists every line of the order to the supplier in both versions', async () => {
      const mail = await renderSupplierOrderEmail({
        supplierName: 'Moulin Dupont',
        orderDay: '2 décembre 2026',
        lines,
      })

      for (const version of [mail.html, mail.text]) {
        expect(version).toContain('Farine T65 : 10 kg')
        expect(version).toContain('Œufs : 6 pièces')
        expect(version).toContain('Miel : 1 pièce')
        expect(version).toContain('2 décembre 2026')
      }
      expect(mail.subject).toBe("Commande de Lay'picerie — Moulin Dupont")
      expect(mail.text).toContain('3 lignes')
      expect(mail.text).toContain('fichier CSV joint')
    })

    it('escapes the supplier name and the product names', async () => {
      const mail = await renderSupplierOrderEmail({
        supplierName: '<b>Moulin</b>',
        orderDay: '2 décembre 2026',
        lines: [{ productName: '<i>Farine</i>', quantity: 1, unit: 'kg' }],
      })

      expect(mail.html).toContain('&lt;i&gt;Farine')
      expect(mail.html).not.toContain('<i>Farine')
      expect(mail.html).not.toContain('<b>Moulin')
    })

    it('escapes the supplier name in the alerts', async () => {
      const mail = await renderMissedDistributionEmail({
        supplierName: '<b>Moulin</b>',
        distributionDay: '4 décembre 2026',
      })

      expect(mail.html).toContain('&lt;b&gt;Moulin')
      expect(mail.html).not.toContain('<b>Moulin')
    })

    it('writes the address of the order in full in both versions of the failure alert', async () => {
      const orderUrl = 'https://app.example.org/admin/purchasing/supplier-orders/order-42'
      const mail = await renderSupplierOrderSendFailedEmail({
        supplierName: 'Moulin Dupont',
        orderId: 'order-42',
        orderDay: '2 décembre 2026',
        mode: 'manual',
        reason: 'mail_error',
        orderUrl,
      })

      expect(mail.html).toContain(orderUrl)
      expect(mail.text).toContain(orderUrl)
      expect(mail.text).toContain('Voir la commande')
      expect(mail.text).toContain('à la main')
      expect(mail.text).toContain("le serveur d'e-mail a refusé le message")
      expect(mail.text).not.toContain("pas d'adresse e-mail")
    })
  })
})
