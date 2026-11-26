import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { config } from '../../config/env.config'
import { COOPERATIVE_TIME_ZONE } from '../../common/paris-time.util'
import { EmailService } from '../email/email.service'
import { findAdminAddresses } from '../members/admin-addresses'
import type { SupplierOrderSentMode } from './contracts/supplier-order.contract'
import { SupplierOrder } from './entities/supplier-order.entity'

interface Notice {
  subject: string
  content: string
}

const FRENCH_DAY = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const FRENCH_PARIS_DAY = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: COOPERATIVE_TIME_ZONE,
})

/** "4 décembre 2026" for a calendar day written `YYYY-MM-DD`. */
function formatDay(day: string): string {
  return FRENCH_DAY.format(new Date(`${day}T12:00:00Z`))
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
    await this.run(`Auto-sent summary for ${input.supplierName}`, async () => ({
      subject: `Commande envoyée automatiquement : ${input.supplierName}`,
      content:
        `La commande de ${input.supplierName} pour la distribution du ` +
        `${formatDay(input.distributionDay)} est partie par e-mail : ` +
        `${plural(input.lineCount, 'ligne', 'lignes')} dans ` +
        `${plural(input.orderCount, 'commande', 'commandes')}.`,
    }))
  }

  /** A send that did not happen: no supplier address, or the mail server refused it. */
  async notifySendFailed(input: {
    supplierName: string
    orderId: string
    mode: SupplierOrderSentMode
    reason: 'no_address' | 'mail_error'
  }): Promise<void> {
    await this.run(
      `Send failure alert for ${input.supplierName}, order ${input.orderId}`,
      async () => {
        const order = await this.em.findOne(SupplierOrder, { id: input.orderId })
        const created = order ? ` du ${FRENCH_PARIS_DAY.format(order.createdAt)}` : ''
        const how = input.mode === 'automatic' ? "l'envoi automatique" : "l'envoi à la main"
        const why =
          input.reason === 'no_address'
            ? "le fournisseur n'a pas d'adresse e-mail"
            : "le serveur d'e-mail a refusé le message"
        return {
          subject: `Commande non envoyée : ${input.supplierName}`,
          content:
            `La commande${created} de ${input.supplierName} (${input.orderId}) n'est pas partie : ` +
            `${how} a échoué, ${why}. La commande reste en brouillon et rien ne sera ` +
            `réessayé tout seul. Il faut la renvoyer à la main : ` +
            this.orderPath(input.orderId),
        }
      },
    )
  }

  /** A distribution started and its order never went out, so nothing was sent for it. */
  async notifyMissedDistribution(input: {
    supplierName: string
    distributionDay: string
  }): Promise<void> {
    await this.run(`Missed distribution alert for ${input.supplierName}`, async () => ({
      subject: `Distribution sans commande envoyée : ${input.supplierName}`,
      content:
        `La distribution du ${formatDay(input.distributionDay)} de ${input.supplierName} a ` +
        `commencé sans que la commande soit partie. Rien n'a été envoyé pour cette ` +
        `distribution. Il faut passer la commande au fournisseur à la main.`,
    }))
  }

  /** Builds the notice, then sends one mail to each admin. Never rejects. */
  private async run(label: string, build: () => Promise<Notice>): Promise<void> {
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
            content: notice.content,
            html: `<p>${escapeHtml(notice.content)}</p>`,
          }),
        ),
      )
      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error(`${label}: an admin mail failed to send`)
        }
      }
    } catch (error) {
      this.logger.error(
        `${label} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }

  /** The back-office address of an order, absolute when the web app address is known. */
  private orderPath(orderId: string): string {
    const base = config.clients.webApp.url.replace(/\/+$/, '')
    return `${base}/admin/purchasing/supplier-orders/${orderId}`
  }
}
