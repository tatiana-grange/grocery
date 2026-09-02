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
  RecordFeePaymentInput,
  SetFeeInput,
  UpdateProfileInput,
  UserRole,
} from './contracts/member.contract'
import { MemberStatusChange } from './entities/member-status-change.entity'
import { MembershipFee } from './entities/membership-fee.entity'
import { MembershipIntakeSetting } from './entities/membership-intake-setting.entity'
import { MembershipPayment } from './entities/membership-payment.entity'
import { Member } from './entities/member.entity'
import { MembersMapper } from './members.mapper'
import { parseRoles, serializeRoles } from './members.util'

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
  // Self-service
  // -----------------------------------------------------------------------------------------------

  /** The signed-in member's own account, with their fee. */
  async getMyAccount(userId: string): Promise<{ member: Member; fee: MembershipFee | undefined }> {
    const member = await this.em.findOne(Member, { user: userId }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')
    return { member, fee: await this.getFeeForMember(member.id) }
  }

  async updateMyProfile(userId: string, input: UpdateProfileInput): Promise<Member> {
    const member = await this.em.findOne(Member, { user: userId }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')
    return this.applyProfile(member, input)
  }

  async updateMemberProfile(id: string, input: UpdateProfileInput): Promise<Member> {
    const member = await this.em.findOne(Member, { id }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')
    return this.applyProfile(member, input)
  }

  private async applyProfile(member: Member, input: UpdateProfileInput): Promise<Member> {
    if (member.version !== input.version) {
      throw new ConflictException(
        'This member changed since you opened it — reload and try again',
      )
    }
    const { version: _version, name, ...profile } = input
    if (name !== undefined) member.user.name = name
    for (const [key, value] of Object.entries(profile)) {
      ;(member as unknown as Record<string, unknown>)[key] = value ?? undefined
    }
    await this.em.flush()
    return member
  }

  // -----------------------------------------------------------------------------------------------
  // Membership fee
  // -----------------------------------------------------------------------------------------------

  private async requireFee(memberId: string): Promise<MembershipFee> {
    const fee = await this.em.findOne(
      MembershipFee,
      { member: memberId },
      { populate: ['payments', 'payments.recordedByUser'] },
    )
    if (!fee) throw new NotFoundException('This member has no fee record yet')
    return fee
  }

  async setExpectedFee(memberId: string, input: SetFeeInput): Promise<MembershipFee> {
    const fee = await this.requireFee(memberId)
    if (fee.version !== input.version) {
      throw new ConflictException('The fee changed since you opened it — reload and try again')
    }
    fee.expectedAmountCents = input.expectedAmountCents
    await this.em.flush()
    return this.requireFee(memberId)
  }

  async recordFeePayment(
    memberId: string,
    input: RecordFeePaymentInput,
    adminUserId: string,
  ): Promise<MembershipFee> {
    const fee = await this.requireFee(memberId)
    const payment = new MembershipPayment()
    payment.fee = fee
    payment.kind = input.kind
    payment.amountCents = input.amountCents
    payment.method = input.method
    payment.paidAt = input.paidAt
    payment.note = input.note ?? undefined
    payment.recordedByUser = this.em.getReference(User, adminUserId)
    this.em.persist(payment)
    await this.em.flush()
    return this.requireFee(memberId)
  }

  async listFeePayments(memberId: string): Promise<MembershipPayment[]> {
    const fee = await this.requireFee(memberId)
    return [...fee.payments.getItems()].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
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
  // Roles
  // -----------------------------------------------------------------------------------------------

  async setRoles(memberId: string, roles: UserRole[], version: number): Promise<Member> {
    return this.em.transactional(async (em) => {
      const member = await em.findOne(Member, { id: memberId }, { populate: ['user'] })
      if (!member) throw new NotFoundException('Member not found')
      if (member.version !== version) {
        throw new ConflictException(
          'This member changed since you opened it — reload and try again',
        )
      }

      const wasAdmin = parseRoles(member.user.role).includes('admin')
      const willBeAdmin = roles.includes('admin')
      if (wasAdmin && !willBeAdmin) {
        const admins = await em.find(User, { role: { $like: '%admin%' } })
        const otherAdmins = admins.filter(
          (user) => user.id !== member.user.id && parseRoles(user.role).includes('admin'),
        )
        if (otherAdmins.length === 0) {
          throw new ConflictException('Cannot remove the last administrator')
        }
      }

      member.user.role = serializeRoles(roles)
      // Touch the member row so its version advances too.
      member.updatedAt = new Date()
      await em.flush()
      return member
    })
  }

  // -----------------------------------------------------------------------------------------------
  // Termination / reactivation
  // -----------------------------------------------------------------------------------------------

  async selfTerminate(userId: string): Promise<Member> {
    const member = await this.em.findOne(Member, { user: userId }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')
    if (member.status !== 'active') {
      throw new BadRequestException(`Member is ${member.status}`)
    }
    this.transitionStatus(member, 'terminated')
    await this.em.flush()
    await this.revokeSessions(userId)
    await this.notifyLifecycle(member, 'terminated')
    return this.getMemberDetail(member.id)
  }

  async adminTerminate(id: string, reason: string, adminUserId: string): Promise<Member> {
    const member = await this.em.findOne(Member, { id }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')
    if (member.status !== 'active') {
      throw new BadRequestException(`Member is ${member.status}`)
    }
    this.transitionStatus(member, 'terminated', { reason, changedByUserId: adminUserId })
    await this.em.flush()
    await this.revokeSessions(member.user.id)
    await this.notifyLifecycle(member, 'terminated', reason)
    return this.getMemberDetail(id)
  }

  async reactivate(id: string, version: number, adminUserId: string): Promise<Member> {
    const member = await this.em.findOne(Member, { id }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')
    if (member.version !== version) {
      throw new ConflictException('This member changed since you opened it — reload and try again')
    }
    if (member.status !== 'terminated') {
      throw new BadRequestException(`Member is ${member.status}`)
    }
    this.transitionStatus(member, 'active', { changedByUserId: adminUserId })
    await this.em.flush()
    await this.notifyLifecycle(member, 'reactivated')
    return this.getMemberDetail(id)
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
    await this.send(user, subject, body)
  }

  private async notifyLifecycle(
    member: Member,
    outcome: 'terminated' | 'reactivated',
    reason?: string,
  ): Promise<void> {
    const user = member.user
    const subject =
      outcome === 'terminated' ? 'Your membership has ended' : 'Your membership is active again'
    const body =
      outcome === 'terminated'
        ? `Hello ${user.name}, your membership has been terminated.${
            reason ? ` Reason: ${reason}` : ''
          }`
        : `Hello ${user.name}, your membership has been reactivated. You can sign in again.`
    await this.send(user, subject, body)
  }

  private async send(user: User, subject: string, body: string): Promise<void> {
    if (user.emailVerified && user.email && !user.email.endsWith('@phone.grocery.local')) {
      await this.emailService.sendEmail({ to: user.email, subject, content: body })
    } else if (user.phoneNumberVerified && user.phoneNumber) {
      await this.smsService.sendSms({ to: user.phoneNumber, content: `${subject}: ${body}` })
    }
  }
}
