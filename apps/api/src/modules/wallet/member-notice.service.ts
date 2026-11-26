import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import type { RenderedEmail } from '../email/email-render'
import {
  renderNegativeBalanceAdminEmail,
  renderNegativeBalanceMemberEmail,
  renderUnderpaidTopupAdminEmail,
} from '../email/email-templates'
import { EmailService } from '../email/email.service'
import { Member } from '../members/entities/member.entity'
import { findAdminAddresses, realAddress } from '../members/admin-addresses'

type Recipient = 'admin' | 'member'

interface Notice {
  recipient: Recipient
  to: string
  mail: RenderedEmail
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
        await renderNegativeBalanceAdminEmail({
          memberName: member.user.name,
          membershipNumber: member.membershipNumber,
          balanceCents,
        }),
      )),
      ...(await this.memberNotices(member)),
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
        await renderUnderpaidTopupAdminEmail({
          memberName: member.user.name,
          membershipNumber: member.membershipNumber,
          requestedCents: input.requestedCents,
          paidCents: input.paidCents,
          topupId: input.topupId,
        }),
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
            subject: notice.mail.subject,
            content: notice.mail.text,
            html: notice.mail.html,
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

  private async memberNotices(member: Member): Promise<Notice[]> {
    const to = realAddress(member.user)
    if (!to) {
      this.logger.log(`Notice: member ${member.id} has no e-mail address, no mail sent`)
      return []
    }
    const mail = await renderNegativeBalanceMemberEmail({ name: member.user.name })
    return [{ recipient: 'member', to, mail }]
  }

  private async adminNotices(mail: RenderedEmail): Promise<Notice[]> {
    const addresses = await findAdminAddresses(this.em, (user) =>
      this.logger.log(`Notice: admin ${user.id} has no e-mail address, skipped`),
    )
    return addresses.map((to) => ({ recipient: 'admin', to, mail }))
  }
}
