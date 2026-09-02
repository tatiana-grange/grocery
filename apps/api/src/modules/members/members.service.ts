import type { FilterQuery } from '@mikro-orm/core'
import { EntityManager, QueryOrder } from '@mikro-orm/core'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { config } from '../../config/env.config'
import { Session, User } from '../auth/auth.entity'
import { SmsService } from '../auth/sms.service'
import { EmailService } from '../email/email.service'
import type {
  MemberFiltering,
  MemberPagination,
  MemberSorting,
  MemberStatus,
  MembershipFeeState,
} from './contracts/member.contract'
import { MemberStatusChange } from './entities/member-status-change.entity'
import { MembershipFee } from './entities/membership-fee.entity'
import { MembershipIntakeSetting } from './entities/membership-intake-setting.entity'
import { Member } from './entities/member.entity'
import { MembersMapper } from './members.mapper'

export interface MembersListResult {
  members: Member[]
  total: number
  pagination: MemberPagination
}

@Injectable()
export class MembersService {
  constructor(
    private readonly em: EntityManager,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  // -----------------------------------------------------------------------------------------------
  // Membership intake
  // -----------------------------------------------------------------------------------------------

  async getIntakeSetting(): Promise<MembershipIntakeSetting> {
    const [existing] = await this.em.find(MembershipIntakeSetting, {}, { limit: 1 })
    if (existing) return existing

    const setting = new MembershipIntakeSetting()
    this.em.persist(setting)
    await this.em.flush()
    return setting
  }

  async isIntakeOpen(): Promise<boolean> {
    return (await this.getIntakeSetting()).open
  }

  async setIntakeOpen(open: boolean): Promise<MembershipIntakeSetting> {
    const setting = await this.getIntakeSetting()
    setting.open = open
    await this.em.flush()
    return setting
  }

  // -----------------------------------------------------------------------------------------------
  // Reads
  // -----------------------------------------------------------------------------------------------

  async getMemberByUserId(userId: string): Promise<Member | null> {
    return this.em.findOne(Member, { user: userId })
  }

  async listMembers(
    pagination: MemberPagination,
    sort?: MemberSorting,
    filter?: MemberFiltering,
  ): Promise<MembersListResult> {
    const where: FilterQuery<Member> = {}

    for (const item of filter ?? []) {
      if (item.property === 'status') Object.assign(where, { status: item.value })
      if (item.property === 'role') {
        Object.assign(where, { user: { role: { $like: `%${item.value}%` } } })
      }
      if (item.property === 'q') {
        const like = `%${item.value}%`
        Object.assign(where, {
          $or: [
            { membershipNumber: { $like: like } },
            { user: { name: { $like: like } } },
            { user: { email: { $like: like } } },
            { user: { phoneNumber: { $like: like } } },
          ],
        })
      }
    }

    const sortItem = sort?.[0]
    const direction =
      sortItem && String(sortItem.direction).toUpperCase() === 'ASC'
        ? QueryOrder.ASC
        : QueryOrder.DESC
    const orderBy =
      sortItem?.property === 'name'
        ? { user: { name: direction } }
        : { createdAt: direction }

    const [members, total] = await this.em.findAndCount(Member, where, {
      populate: ['user', 'statusChanges'],
      orderBy,
      limit: pagination.pageSize,
      offset: pagination.offset,
    })

    return { members, total, pagination }
  }

  async getMemberDetail(id: string): Promise<Member> {
    const member = await this.em.findOne(
      Member,
      { id },
      { populate: ['user', 'statusChanges', 'statusChanges.changedByUser'] },
    )
    if (!member) throw new NotFoundException('Member not found')
    return member
  }

  /** Derived fee state per member id, for list rows. */
  async feeStatesFor(memberIds: string[]): Promise<Map<string, MembershipFeeState>> {
    const result = new Map<string, MembershipFeeState>()
    if (memberIds.length === 0) return result

    const fees = await this.em.find(
      MembershipFee,
      { member: { $in: memberIds } },
      { populate: ['payments'] },
    )
    for (const fee of fees) {
      const paid = fee.payments.getItems().reduce((sum, payment) => sum + payment.amountCents, 0)
      result.set(
        fee.member.id,
        MembersMapper.deriveFeeState(fee.expectedAmountCents, paid),
      )
    }
    return result
  }

  async getFeeForMember(memberId: string): Promise<MembershipFee | undefined> {
    return (
      (await this.em.findOne(
        MembershipFee,
        { member: memberId },
        { populate: ['payments', 'payments.recordedByUser'] },
      )) ?? undefined
    )
  }

  // -----------------------------------------------------------------------------------------------
  // Validation / rejection
  // -----------------------------------------------------------------------------------------------

  async validateMember(id: string, version: number, adminUserId: string): Promise<Member> {
    const member = await this.loadPendingForDecision(id, version)

    this.transitionStatus(member, 'active', { changedByUserId: adminUserId })
    member.joinedAt ??= new Date()

    // Ensure a membership-fee row exists once the member is active.
    const existingFee = await this.em.findOne(MembershipFee, { member: member.id })
    if (!existingFee) {
      const fee = new MembershipFee()
      fee.member = member
      fee.expectedAmountCents = config.members.membershipFeeDefaultCents
      this.em.persist(fee)
    }

    await this.em.flush()
    await this.notifyDecision(member, 'validated')
    return this.getMemberDetail(id)
  }

  async rejectMember(
    id: string,
    version: number,
    reason: string,
    adminUserId: string,
  ): Promise<Member> {
    const member = await this.loadPendingForDecision(id, version)

    this.transitionStatus(member, 'rejected', { reason, changedByUserId: adminUserId })
    await this.em.flush()

    await this.revokeSessions(member.user.id)
    await this.notifyDecision(member, 'rejected', reason)
    return this.getMemberDetail(id)
  }

  private async loadPendingForDecision(id: string, version: number): Promise<Member> {
    const member = await this.em.findOne(Member, { id }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')
    if (member.version !== version) {
      throw new ConflictException('This member changed since you opened it — reload and try again')
    }
    if (member.status !== 'pending') {
      throw new BadRequestException(`Member is already ${member.status}`)
    }
    return member
  }

  private transitionStatus(
    member: Member,
    toStatus: MemberStatus,
    options: { reason?: string; changedByUserId?: string } = {},
  ): void {
    const change = new MemberStatusChange()
    change.member = member
    change.fromStatus = member.status
    change.toStatus = toStatus
    if (options.reason) change.reason = options.reason
    if (options.changedByUserId) {
      change.changedByUser = this.em.getReference(User, options.changedByUserId)
    }
    member.statusChanges.add(change)
    member.status = toStatus
    this.em.persist(change)
  }

  private async revokeSessions(userId: string): Promise<void> {
    // The status flip is the real authority (the guard blocks non-active members); dropping the
    // sessions just signs them out promptly.
    await this.em.nativeDelete(Session, { user: userId })
  }

  // -----------------------------------------------------------------------------------------------
  // Notifications
  // -----------------------------------------------------------------------------------------------

  private async notifyDecision(
    member: Member,
    outcome: 'validated' | 'rejected',
    reason?: string,
  ): Promise<void> {
    const user = member.user
    const subject =
      outcome === 'validated' ? 'Your membership is confirmed' : 'Your membership request'
    const body =
      outcome === 'validated'
        ? `Hello ${user.name}, your membership has been approved. You can now sign in.`
        : `Hello ${user.name}, your membership request was not approved.${
            reason ? ` Reason: ${reason}` : ''
          }`

    if (user.emailVerified && user.email && !user.email.endsWith('@phone.grocery.local')) {
      await this.emailService.sendEmail({ to: user.email, subject, content: body })
    } else if (user.phoneNumberVerified && user.phoneNumber) {
      await this.smsService.sendSms({ to: user.phoneNumber, content: `${subject}: ${body}` })
    }
  }
}
