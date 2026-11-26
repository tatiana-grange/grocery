import { Injectable } from '@nestjs/common'
import { COOPERATIVE_TIME_ZONE } from '../../common/paris-time.util'
import { EmailService } from '../email/email.service'
import { realAddress } from '../members/admin-addresses'
import type { SupplierOrder } from './entities/supplier-order.entity'
import { PurchasingMapper } from './purchasing.mapper'

export type OrderMailResult = { sentTo: string } | { sentTo: null; reason: 'no_address' }

/** The mail server refused the order e-mail. */
export class OrderMailError extends Error {}

const FRENCH_PARIS_DAY = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: COOPERATIVE_TIME_ZONE,
})

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The only place that knows what the order e-mail says. Sent to the supplier's address, with
 * the referent in copy and the same CSV staff can download attached.
 */
@Injectable()
export class SupplierOrderMailService {
  constructor(
    private readonly email: EmailService,
    private readonly mapper: PurchasingMapper,
  ) {}

  /**
   * Needs `supplier`, `supplier.referent`, `supplier.referent.user`, `lines` and
   * `lines.product` loaded. Resolves `{ sentTo: null }` when the supplier has no address;
   * throws `OrderMailError` when the mail server refuses.
   */
  async sendOrder(order: SupplierOrder): Promise<OrderMailResult> {
    const to = order.supplier.contactEmail?.trim()
    if (!to) return { sentTo: null, reason: 'no_address' }

    const lines = order.lines.getItems()
    const textLines = lines.map((line) => {
      const quantity = Number(line.quantity)
      const unit = line.product.saleMode === 'weight' ? 'kg' : quantity > 1 ? 'pièces' : 'pièce'
      return `${line.product.name} : ${quantity} ${unit}`
    })
    const day = FRENCH_PARIS_DAY.format(order.createdAt)
    const intro =
      `Bonjour,\n\nVoici la commande de la coopérative Grocery du ${day} ` +
      `(${lines.length} ${lines.length === 1 ? 'ligne' : 'lignes'}).`
    const outro = 'Le détail est aussi dans le fichier CSV joint.\n\nMerci et bonne journée.'
    const content = `${intro}\n\n${textLines.join('\n')}\n\n${outro}`
    const html =
      `<p>Bonjour,</p><p>Voici la commande de la coopérative Grocery du ${escapeHtml(day)} ` +
      `(${lines.length} ${lines.length === 1 ? 'ligne' : 'lignes'}).</p>` +
      `<ul>${textLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` +
      `<p>Le détail est aussi dans le fichier CSV joint.</p><p>Merci et bonne journée.</p>`

    const referent = order.supplier.referent
    const cc =
      referent?.contactEmail?.trim() || (referent?.user ? realAddress(referent.user) : null)
    const exported = this.mapper.toExport(order)

    try {
      await this.email.sendEmail({
        to,
        ...(cc ? { cc: [cc] } : {}),
        subject: `Commande de la coopérative Grocery — ${order.supplier.name}`,
        content,
        html,
        attachments: [
          { filename: exported.filename, content: exported.content, contentType: 'text/csv' },
        ],
      })
    } catch (error) {
      throw new OrderMailError(error instanceof Error ? error.message : 'Unknown mail error')
    }
    return { sentTo: to }
  }
}
