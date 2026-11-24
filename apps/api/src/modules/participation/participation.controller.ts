import {
  PaginationParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedQuery,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { HttpCode, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { AdminOnly, MemberScoped, Session } from '../auth/auth.decorator'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { AuthGuard } from '../auth/auth.guard'
import {
  adminSlotDetailSchema,
  adminSlotListSchema,
  adminSlotSchema,
  includePastSchema,
  memberSlotListSchema,
  memberSlotSchema,
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
    return {
      data: items.map((slot) => this.mapper.toAdminSlot(slot)),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
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
    private readonly mapper: ParticipationMapper,
  ) {}

  @TypedRoute.Get('slots', memberSlotListSchema)
  async listComing(
    @Session() session: LoggedInBetterAuthSession,
    @PaginationParams(slotPaginationSchema) pagination: SlotPagination,
  ) {
    const member = await this.participation.getMemberForUser(session.user.id)
    const { items, total } = await this.participation.listComingSlots(pagination)
    return {
      data: items.map((slot) => this.mapper.toMemberSlot(slot, member.id)),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  @TypedRoute.Post('slots/:slotId/signup', memberSlotSchema)
  async signUp(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('slotId', z.string().uuid()) slotId: string,
  ) {
    const member = await this.participation.getMemberForUser(session.user.id)
    const slot = await this.participation.signUp({ slotId, memberId: member.id, actor: 'member' })
    return this.mapper.toMemberSlot(slot, member.id)
  }
}
