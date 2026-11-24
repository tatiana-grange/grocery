import { EntityManager, QueryOrder } from '@mikro-orm/core'
import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import type { SlotInput } from './contracts/slot.contract'
import { Slot } from './entities/slot.entity'

/** A page of results and the total they were cut from. */
export interface Page<T> {
  items: T[]
  total: number
}

interface PageRequest {
  pageSize: number
  offset: number
}

/** The clock the rules read. The service spec passes a fixed one; the controllers use the default. */
export type Clock = () => Date

/**
 * Participation slots and the sign-ups on them. The rules live in `participation.util.ts`; this
 * service loads the facts, calls them and writes.
 */
@Injectable()
export class ParticipationService {
  constructor(
    private readonly em: EntityManager,
    @Optional() private readonly clock: Clock = () => new Date(),
  ) {}

  /** Creates a slot. The contract already checked the label, the places and the order of the times. */
  async createSlot(input: SlotInput): Promise<Slot> {
    const slot = new Slot()
    slot.roleLabel = input.roleLabel
    slot.startsAt = input.startsAt
    slot.endsAt = input.endsAt
    slot.places = input.places
    this.em.persist(slot)
    await this.em.flush()
    return slot
  }

  /** Slots by start, earliest first. Slots that have ended are hidden unless `includePast`. */
  async listSlotsForAdmin(p: { includePast: boolean } & PageRequest): Promise<Page<Slot>> {
    const now = this.clock()
    const [items, total] = await this.em.findAndCount(
      Slot,
      p.includePast ? {} : { endsAt: { $gt: now } },
      {
        orderBy: { startsAt: QueryOrder.ASC, id: QueryOrder.ASC },
        limit: p.pageSize,
        offset: p.offset,
        populate: ['signups'],
      },
    )
    return { items, total }
  }

  /** One slot with its sign-ups, the members and their users loaded. */
  async getSlotForAdmin(slotId: string): Promise<Slot> {
    const slot = await this.em.findOne(
      Slot,
      { id: slotId },
      { populate: ['signups', 'signups.member', 'signups.member.user'] },
    )
    if (!slot) throw new NotFoundException('Slot not found')
    return slot
  }
}
