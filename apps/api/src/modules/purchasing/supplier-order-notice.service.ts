import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { config } from '../../config/env.config'
import { describeError } from '../../common/error.util'
import { formatParisDayInFrench } from '../../common/paris-time.util'
import type { RenderedEmail } from '../email/email-render'
import {
  renderMissedDistributionEmail,
  renderSupplierOrderAutoSentEmail,
  renderSupplierOrderSendFailedEmail,
} from '../email/email-templates'
import { EmailService } from '../email/email.service'
import { findAdminAddresses } from '../members/admin-addresses'
import type { SupplierOrderSentMode } from './contracts/supplier-order.contract'
import { SupplierOrder } from './entities/supplier-order.entity'
import type { SendFailureReason } from './supplier-order-mail.service'

const FRENCH_DAY = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "4 décembre 2026" for a calendar day written `YYYY-MM-DD`. */
function formatDay(day: string): string {
  return FRENCH_DAY.format(new Date(`${day}T12:00:00Z`))
}

/**
 * The e-mails the admins get about supplier orders: what an automatic run sent, a send that
 * failed (by hand or automatic), and a distribution that started with no order sent. Same
 * pattern as the wallet notices: every method catches everything, logs it with the supplier
 * and the order, and never rejects, so a mail problem can never undo the send behind it.
 */
@Injectable()
export class SupplierOrderNoticeService {
  private readonly logger = new Logger(SupplierOrderNoticeService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly email: EmailService,
  ) {}

  /** After an automatic run sent at least one order. */
  async notifyAutoSent(input: {
    supplierName: string
    distributionDay: string
    lineCount: number
    orderCount: number
  }): Promise<void> {
    await this.run(`Auto-sent summary for ${input.supplierName}`, async () =>
      renderSupplierOrderAutoSentEmail({
        supplierName: input.supplierName,
        distributionDay: formatDay(input.distributionDay),
        lineCount: input.lineCount,
        orderCount: input.orderCount,
      }),
    )
  }

  /** A send that did not happen: no supplier address, or the mail server refused it. */
  async notifySendFailed(input: {
    supplierName: string
    orderId: string
    mode: SupplierOrderSentMode
    reason: SendFailureReason
  }): Promise<void> {
    await this.run(
      `Send failure alert for ${input.supplierName}, order ${input.orderId}`,
      async () => {
        const order = await this.em.findOne(SupplierOrder, { id: input.orderId })
        return renderSupplierOrderSendFailedEmail({
          supplierName: input.supplierName,
          orderId: input.orderId,
          orderDay: order ? formatParisDayInFrench(order.createdAt) : undefined,
          mode: input.mode,
          reason: input.reason,
          orderUrl: this.orderPath(input.orderId),
        })
      },
    )
  }

  /** A distribution started and its order never went out, so nothing was sent for it. */
  async notifyMissedDistribution(input: {
    supplierName: string
    distributionDay: string
  }): Promise<void> {
    await this.run(`Missed distribution alert for ${input.supplierName}`, async () =>
      renderMissedDistributionEmail({
        supplierName: input.supplierName,
        distributionDay: formatDay(input.distributionDay),
      }),
    )
  }

  /** Builds the notice, then sends one mail to each admin. Never rejects. */
  private async run(label: string, build: () => Promise<RenderedEmail>): Promise<void> {
    try {
      const notice = await build()
      const addresses = await findAdminAddresses(this.em, (user) =>
        this.logger.log(`${label}: admin ${user.id} has no e-mail address, skipped`),
      )
      const results = await Promise.allSettled(
        addresses.map((to) =>
          this.email.sendEmail({
            to,
            subject: notice.subject,
            content: notice.text,
            html: notice.html,
          }),
        ),
      )
      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error(`${label}: an admin mail failed to send`)
        }
      }
    } catch (error) {
      this.logger.error(`${label} failed: ${describeError(error)}`)
    }
  }

  /** The back-office address of an order, absolute when the web app address is known. */
  private orderPath(orderId: string): string {
    const base = config.clients.webApp.url.replace(/\/+$/, '')
    return `${base}/admin/purchasing/supplier-orders/${orderId}`
  }
}
