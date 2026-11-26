import { Injectable } from '@nestjs/common'
import { describeError } from '../../common/error.util'
import { formatParisDayInFrench } from '../../common/paris-time.util'
import { renderSupplierOrderEmail } from '../email/email-templates'
import { EmailService } from '../email/email.service'
import { realAddress } from '../members/admin-addresses'
import type { SupplierOrder } from './entities/supplier-order.entity'
import { PurchasingMapper } from './purchasing.mapper'

/** Why an order did not leave: the supplier has no address, or the mail server refused it. */
export type SendFailureReason = 'no_address' | 'mail_error'

/** What `sendOrder` needs loaded on the order. The caller populates exactly this. */
export const ORDER_MAIL_POPULATE = [
  'supplier',
  'supplier.referent',
  'supplier.referent.user',
  'lines',
  'lines.product',
] as const

export type OrderMailResult =
  | { sentTo: string }
  | { sentTo: null; reason: Extract<SendFailureReason, 'no_address'> }

/** The mail server refused the order e-mail. */
export class OrderMailError extends Error {}

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

    const mail = await renderSupplierOrderEmail({
      supplierName: order.supplier.name,
      orderDay: formatParisDayInFrench(order.createdAt),
      lines: order.lines.getItems().map((line) => {
        const quantity = Number(line.quantity)
        const unit = line.product.saleMode === 'weight' ? 'kg' : quantity > 1 ? 'pièces' : 'pièce'
        return { productName: line.product.name, quantity, unit }
      }),
    })

    const referent = order.supplier.referent
    const cc =
      referent?.contactEmail?.trim() || (referent?.user ? realAddress(referent.user) : null)
    const exported = this.mapper.toExport(order)

    try {
      await this.email.sendEmail({
        to,
        ...(cc ? { cc: [cc] } : {}),
        subject: mail.subject,
        content: mail.text,
        html: mail.html,
        attachments: [
          { filename: exported.filename, content: exported.content, contentType: 'text/csv' },
        ],
      })
    } catch (error) {
      throw new OrderMailError(describeError(error))
    }
    return { sentTo: to }
  }
}
