import { EntityManager, LockMode, QueryOrder } from '@mikro-orm/core'
import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { refusal } from '../../common/refusal'
import type { SlotEditRefusal, SlotInput } from './contracts/slot.contract'
import { SlotSignup } from './entities/slot-signup.entity'
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

  /**
   * Replaces a slot's label, places and times. Admin only. The slot row is locked, so an edit
   * and a sign-up at the same moment see each other: the places never end below the sign-ups.
   *
   * The label and the places may change at any time before the slot ends. The times may change
   * only while nobody is signed up, so a booked commitment never moves and the no-overlap rule
   * of the members on it never breaks silently.
   */
  async updateSlot(slotId: string, input: SlotInput): Promise<Slot> {
    return this.em.transactional(async (tem) => {
      const slot = await this.lockSlot(tem, slotId)
      this.assertNotEnded(slot)
      const signedUpCount = await tem.count(SlotSignup, { slot: slot.id })
      const timesChanged =
        slot.startsAt.getTime() !== input.startsAt.getTime() ||
        slot.endsAt.getTime() !== input.endsAt.getTime()
      if (timesChanged && signedUpCount > 0) {
        throw refusal(
          'slot_has_signups' satisfies SlotEditRefusal,
          'The date and times cannot change while members are signed up',
        )
      }
      if (input.places < signedUpCount) {
        throw refusal(
          'places_below_signups' satisfies SlotEditRefusal,
          'The places cannot drop below the sign-ups already there',
          { signedUpCount },
        )
      }
      slot.roleLabel = input.roleLabel
      slot.startsAt = input.startsAt
      slot.endsAt = input.endsAt
      slot.places = input.places
      await tem.flush()
      await tem.populate(slot, ['signups'])
      return slot
    })
  }

  /**
   * Cancels a slot. This is the only place `cancelledAt` is ever set, and nothing sets it back:
   * the members signed up have been told the slot is off. Cancelling a cancelled slot changes
   * nothing and keeps the first time stamp. A slot that has ended cannot be cancelled.
   */
  async cancelSlot(slotId: string): Promise<Slot> {
    return this.em.transactional(async (tem) => {
      const slot = await this.lockSlot(tem, slotId)
      this.assertNotEnded(slot)
      if (!slot.cancelledAt) {
        slot.cancelledAt = this.clock()
        await tem.flush()
      }
      await tem.populate(slot, ['signups'])
      return slot
    })
  }

  /** Deletes a slot nobody is signed up on. A slot with sign-ups is cancelled, never deleted. */
  async deleteSlot(slotId: string): Promise<void> {
    await this.em.transactional(async (tem) => {
      const slot = await this.lockSlot(tem, slotId)
      if ((await tem.count(SlotSignup, { slot: slot.id })) > 0) {
        throw refusal(
          'slot_has_signups' satisfies SlotEditRefusal,
          'A slot with sign-ups cannot be deleted, cancel it instead',
        )
      }
      tem.remove(slot)
      await tem.flush()
    })
  }

  private async lockSlot(em: EntityManager, slotId: string): Promise<Slot> {
    const slot = await em.findOne(Slot, { id: slotId }, { lockMode: LockMode.PESSIMISTIC_WRITE })
    if (!slot) throw new NotFoundException('Slot not found')
    return slot
  }

  private assertNotEnded(slot: Slot): void {
    if (this.clock() >= slot.endsAt) {
      throw refusal('slot_ended' satisfies SlotEditRefusal, 'This slot has already ended')
    }
  }
}
