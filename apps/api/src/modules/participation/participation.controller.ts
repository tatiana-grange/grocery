import {
  PaginationParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedQuery,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { AdminOnly } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  adminSlotDetailSchema,
  adminSlotListSchema,
  adminSlotSchema,
  includePastSchema,
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
}
