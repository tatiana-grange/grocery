import {
  PaginationParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedQuery,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { HttpCode, NotFoundException, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { AdminOnly, MemberScoped, Session } from '../auth/auth.decorator'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { AuthGuard } from '../auth/auth.guard'
import type { Member } from '../members/entities/member.entity'
import { MembersService } from '../members/members.service'
import {
  adminSlotDetailSchema,
  adminSlotListSchema,
  adminSlotSchema,
  includePastSchema,
  memberSlotListSchema,
  memberSlotSchema,
  mySignupListSchema,
  type SignUpMemberInput,
  signUpMemberSchema,
  type SlotInput,
  slotInputSchema,
  type SlotPagination,
  slotPaginationSchema,
} from './contracts/slot.contract'
import { ParticipationMapper } from './participation.mapper'
import { ParticipationService } from './participation.service'

/** The back office: create and list slots, read one with its sign-ups. */
@TypedController('admin/slots', undefined, { tags: ['Admin Slots'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminSlotsController {
  constructor(
    private readonly participation: ParticipationService,
    private readonly mapper: ParticipationMapper,
  ) {}

  @TypedRoute.Get('', adminSlotListSchema)
  async list(
    @PaginationParams(slotPaginationSchema) pagination: SlotPagination,
    @TypedQuery('includePast', includePastSchema) includePast: boolean,
  ) {
    const { items, total } = await this.participation.listSlotsForAdmin({
      includePast,
      ...pagination,
    })
    return this.mapper.toAdminSlotList({ items, total, pagination })
  }

  @TypedRoute.Get(':slotId', adminSlotDetailSchema)
  async detail(@TypedParam('slotId', z.string().uuid()) slotId: string) {
    return this.mapper.toAdminSlotDetail(await this.participation.getSlotForAdmin(slotId))
  }

  @TypedRoute.Post('', adminSlotSchema)
  async create(@TypedBody(slotInputSchema) body: SlotInput) {
    const slot = await this.participation.createSlot(body)
    return this.mapper.toAdminSlot(slot)
  }

  /** Replaces the label, places and times. Any other field in the body is ignored. */
  @TypedRoute.Put(':slotId', adminSlotSchema)
  async update(
    @TypedParam('slotId', z.string().uuid()) slotId: string,
    @TypedBody(slotInputSchema) body: SlotInput,
  ) {
    return this.mapper.toAdminSlot(await this.participation.updateSlot(slotId, body))
  }

  /** The one route that cancels a slot. Final, and a second call changes nothing. */
  @TypedRoute.Post(':slotId/cancel', adminSlotSchema)
  @HttpCode(200)
  async cancel(@TypedParam('slotId', z.string().uuid()) slotId: string) {
    return this.mapper.toAdminSlot(await this.participation.cancelSlot(slotId))
  }

  @TypedRoute.Delete(':slotId')
  @HttpCode(204)
  async remove(@TypedParam('slotId', z.string().uuid()) slotId: string): Promise<void> {
    await this.participation.deleteSlot(slotId)
  }

  /** Signs any member up, even after the slot has started. A full slot still refuses. */
  @TypedRoute.Post(':slotId/signups', adminSlotDetailSchema)
  async signUpMember(
    @TypedParam('slotId', z.string().uuid()) slotId: string,
    @TypedBody(signUpMemberSchema) body: SignUpMemberInput,
  ) {
    await this.participation.signUp({ slotId, memberId: body.memberId, actor: 'admin' })
    return this.mapper.toAdminSlotDetail(await this.participation.getSlotForAdmin(slotId))
  }

  /** Removes any member's sign-up at any time before the slot ends. */
  @TypedRoute.Delete(':slotId/signups/:memberId', adminSlotDetailSchema)
  async removeMember(
    @TypedParam('slotId', z.string().uuid()) slotId: string,
    @TypedParam('memberId', z.string().uuid()) memberId: string,
  ) {
    await this.participation.removeSignup({ slotId, memberId, actor: 'admin' })
    return this.mapper.toAdminSlotDetail(await this.participation.getSlotForAdmin(slotId))
  }
}

/**
 * A member reading the coming slots and signing themselves up. The member row is the caller's
 * own: no route here takes a member id.
 */
@TypedController('me', undefined, { tags: ['Member Slots'] })
@UseGuards(AuthGuard)
@MemberScoped()
export class MemberSlotsController {
  constructor(
    private readonly participation: ParticipationService,
    private readonly members: MembersService,
    private readonly mapper: ParticipationMapper,
  ) {}

  /** An admin who is not a member gets a 404. */
  private async getCallerMember(session: LoggedInBetterAuthSession): Promise<Member> {
    const member = await this.members.getMemberByUserId(session.user.id)
    if (!member) throw new NotFoundException('Member not found')
    return member
  }

  @TypedRoute.Get('slots', memberSlotListSchema)
  async listComing(
    @Session() session: LoggedInBetterAuthSession,
    @PaginationParams(slotPaginationSchema) pagination: SlotPagination,
  ) {
    const member = await this.getCallerMember(session)
    const { items, total } = await this.participation.listComingSlots(pagination)
    return this.mapper.toMemberSlotList({ items, total, pagination, memberId: member.id })
  }

  @TypedRoute.Post('slots/:slotId/signup', memberSlotSchema)
  async signUp(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('slotId', z.string().uuid()) slotId: string,
  ) {
    const member = await this.getCallerMember(session)
    const slot = await this.participation.signUp({ slotId, memberId: member.id, actor: 'member' })
    return this.mapper.toMemberSlot(slot, member.id)
  }

  /** Leaves the caller's own sign-up. The route takes no member id, so nobody leaves for another. */
  @TypedRoute.Delete('slots/:slotId/signup', memberSlotSchema)
  async leave(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('slotId', z.string().uuid()) slotId: string,
  ) {
    const member = await this.getCallerMember(session)
    const slot = await this.participation.removeSignup({
      slotId,
      memberId: member.id,
      actor: 'member',
    })
    return this.mapper.toMemberSlot(slot, member.id)
  }

  @TypedRoute.Get('signups', mySignupListSchema)
  async listMine(
    @Session() session: LoggedInBetterAuthSession,
    @PaginationParams(slotPaginationSchema) pagination: SlotPagination,
  ) {
    const member = await this.getCallerMember(session)
    const { items, total } = await this.participation.listMySignups(member.id, pagination)
    const now = this.participation.getNow()
    return this.mapper.toMySignupList({ items, total, pagination, now })
  }
}
