import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { escapeHtml } from '../../common/html.util'
import { EmailService } from '../email/email.service'
import { Member } from '../members/entities/member.entity'
import { findAdminAddresses, realAddress } from '../members/admin-addresses'

type Recipient = 'admin' | 'member'

interface Notice {
  recipient: Recipient
  to: string
  subject: string
  content: string
  html: string
}

/**
 * The notice e-mails of the wallet. A payment correction that leaves a member below zero mails
 * the member and each admin. A top-up paid short mails the admins. It never rejects, so a mail
 * problem can never undo what triggered it. A failure is logged with the member id and the
 * recipient role.
 */
@Injectable()
export class MemberNoticeService {
  private readonly logger = new Logger(MemberNoticeService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly email: EmailService,
  ) {}

  async notifyNegativeBalance(memberId: string, balanceCents: number): Promise<void> {
    await this.run('Negative balance notice', memberId, async (member) => [
      ...(await this.adminNotices(
        `Solde négatif : ${member.user.name}`,
        `${member.user.name} (adhérent n° ${member.membershipNumber}) a un solde négatif : ` +
          `${formatEuros(balanceCents)}.`,
      )),
      ...this.memberNotices(member),
    ])
  }

  /**
   * Tells the admins that a payer paid less than the top-up asked for. Nothing was credited and
   * the top-up is still pending, so someone has to follow it up by hand. The caller stamps the
   * top-up before calling, so this is sent at most once per top-up. Admins only. Never rejects.
   */
  async notifyUnderpaidTopup(input: {
    memberId: string
    requestedCents: number
    paidCents: number
    topupId: string
  }): Promise<void> {
    await this.run(`Underpaid top-up ${input.topupId} notice`, input.memberId, async (member) =>
      this.adminNotices(
        `Paiement incomplet : ${member.user.name}`,
        `${member.user.name} (adhérent n° ${member.membershipNumber}) a payé ` +
          `${formatEuros(input.paidCents)} pour un rechargement de ` +
          `${formatEuros(input.requestedCents)}. Rien n'a été crédité et le rechargement reste ` +
          `en attente (${input.topupId}). Il faut le suivre avec le payeur et dans l'espace ` +
          `HelloAsso.`,
      ),
    )
  }

  /** Loads the member, builds the notices and sends them all. Never rejects. */
  private async run(
    label: string,
    memberId: string,
    build: (member: Member) => Promise<Notice[]>,
  ): Promise<void> {
    try {
      const member = await this.em.findOne(Member, { id: memberId }, { populate: ['user'] })
      if (!member) {
        this.logger.error(`${label}: member ${memberId} not found, nothing sent`)
        return
      }
      const notices = await build(member)
      const results = await Promise.allSettled(
        notices.map((notice) =>
          this.email.sendEmail({
            to: notice.to,
            subject: notice.subject,
            content: notice.content,
            html: notice.html,
          }),
        ),
      )
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.error(
            `${label} for member ${memberId} failed to send to the ${notices[index]?.recipient}`,
          )
        }
      })
    } catch (error) {
      this.logger.error(
        `${label} for member ${memberId} failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
    }
  }

  private memberNotices(member: Member): Notice[] {
    const to = realAddress(member.user)
    if (!to) {
      this.logger.log(`Notice: member ${member.id} has no e-mail address, no mail sent`)
      return []
    }
    const content =
      `Bonjour ${member.user.name}, il y a un problème sur votre compte. ` +
      `Vos achats sont suspendus pour le moment. Vous pouvez recharger votre compte ` +
      `ou contacter la coopérative.`
    return [
      {
        recipient: 'member',
        to,
        subject: 'Un problème sur votre compte',
        content,
        html: `<p>${escapeHtml(content)}</p>`,
      },
    ]
  }

  private async adminNotices(subject: string, content: string): Promise<Notice[]> {
    const addresses = await findAdminAddresses(this.em, (user) =>
      this.logger.log(`Notice: admin ${user.id} has no e-mail address, skipped`),
    )
    const notices: Notice[] = addresses.map((to) => ({
      recipient: 'admin',
      to,
      subject,
      content,
      html: `<p>${escapeHtml(content)}</p>`,
    }))
    return notices
  }
}

function formatEuros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}
