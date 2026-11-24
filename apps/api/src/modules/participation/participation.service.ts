import {
  EntityManager,
  LockMode,
  QueryOrder,
  UniqueConstraintViolationException,
} from '@mikro-orm/core'
import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { refusal } from '../../common/refusal'
import { Member } from '../members/entities/member.entity'
import type {
  RemovalRefusal,
  SignUpRefusal,
  SlotEditRefusal,
  SlotInput,
} from './contracts/slot.contract'
import { SlotSignup } from './entities/slot-signup.entity'
import { Slot } from './entities/slot.entity'
import { type Actor, checkRemoval, checkSignUp } from './participation.util'

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
  async listSlotsForAdmin(request: { includePast: boolean } & PageRequest): Promise<Page<Slot>> {
    const now = this.clock()
    const [items, total] = await this.em.findAndCount(
      Slot,
      request.includePast ? {} : { endsAt: { $gt: now } },
      {
        orderBy: { startsAt: QueryOrder.ASC, id: QueryOrder.ASC },
        limit: request.pageSize,
        offset: request.offset,
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

  /** Slots that start after now and are not cancelled, earliest first, with their sign-ups. */
  async listComingSlots(page: PageRequest): Promise<Page<Slot>> {
    const [items, total] = await this.em.findAndCount(
      Slot,
      { startsAt: { $gt: this.clock() }, cancelledAt: null },
      {
        orderBy: { startsAt: QueryOrder.ASC, id: QueryOrder.ASC },
        limit: page.pageSize,
        offset: page.offset,
        populate: ['signups'],
      },
    )
    return { items, total }
  }

  /**
   * Signs a member up on a slot, under two row locks always taken in the same order: the member
   * row first, then the slot row. The slot lock is what protects the last place from two
   * sign-ups. The member lock is what protects the no-overlap rule: two sign-ups of one member
   * for two overlapping slots lock different slots, so only the shared member row makes the
   * second one see the first. One fixed order rules out a deadlock between two sign-ups.
   *
   * `checkSignUp` decides the refusals that need only the slot and the clock. A member already
   * on the slot is told so even when it is full, because that is the useful answer. The overlap
   * check comes last. The unique pair of the table backs the one-sign-up rule if two calls race
   * anyway. Returns the slot with its sign-ups.
   */
  async signUp(input: { slotId: string; memberId: string; actor: Actor }): Promise<Slot> {
    try {
      return await this.em.transactional(async (tem) => {
        const member = await tem.findOne(
          Member,
          { id: input.memberId },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        )
        if (!member) throw new NotFoundException('Member not found')
        const slot = await this.lockSlot(tem, input.slotId)
        const signedUpCount = await tem.count(SlotSignup, { slot: slot.id })
        const alreadySignedUp =
          (await tem.count(SlotSignup, { slot: slot.id, member: member.id })) > 0
        const refused = checkSignUp({
          slot: {
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            places: slot.places,
            isCancelled: slot.cancelledAt != null,
            signedUpCount,
          },
          actor: input.actor,
          now: this.clock(),
        })
        if (alreadySignedUp && (refused === null || refused === 'slot_full')) {
          throw this.signUpRefusal('already_signed_up')
        }
        if (refused) throw this.signUpRefusal(refused)
        if (await this.holdsAnOverlappingSlot(tem, member.id, slot)) {
          throw this.signUpRefusal('overlaps_another_slot')
        }

        const signup = new SlotSignup()
        signup.slot = slot
        signup.member = member
        tem.persist(signup)
        await tem.flush()
        await tem.populate(slot, ['signups'])
        return slot
      })
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw this.signUpRefusal('already_signed_up')
      }
      throw error
    }
  }

  /**
   * Whether the member holds a live slot that overlaps this one. The condition is the one of
   * `doRangesOverlap`, written as a filter: slots that merely touch do not overlap, and a
   * cancelled slot never blocks.
   */
  private async holdsAnOverlappingSlot(
    em: EntityManager,
    memberId: string,
    slot: Slot,
  ): Promise<boolean> {
    const count = await em.count(SlotSignup, {
      member: memberId,
      slot: {
        cancelledAt: null,
        startsAt: { $lt: slot.endsAt },
        endsAt: { $gt: slot.startsAt },
      },
    })
    return count > 0
  }

  /**
   * Removes one sign-up: a member leaving, or an admin removing someone. Only the slot row is
   * locked. `checkRemoval` decides whether the actor may. A member who is not signed up, and an
   * unknown slot, are both a 404. Returns the slot with its remaining sign-ups.
   */
  async removeSignup(input: { slotId: string; memberId: string; actor: Actor }): Promise<Slot> {
    return this.em.transactional(async (tem) => {
      const slot = await this.lockSlot(tem, input.slotId)
      const signup = await tem.findOne(SlotSignup, { slot: slot.id, member: input.memberId })
      if (!signup) throw new NotFoundException('Sign-up not found')
      const refused = checkRemoval({
        slot: {
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          isCancelled: slot.cancelledAt != null,
        },
        actor: input.actor,
        now: this.clock(),
      })
      if (refused) throw this.removalRefusal(refused)
      tem.remove(signup)
      await tem.flush()
      await tem.populate(slot, ['signups'], { refresh: true })
      return slot
    })
  }

  /**
   * A member's sign-ups on slots that have not ended, earliest start first. Cancelled slots are
   * included: the member must see that the slot is off.
   */
  async listMySignups(memberId: string, page: PageRequest): Promise<Page<SlotSignup>> {
    const [items, total] = await this.em.findAndCount(
      SlotSignup,
      { member: memberId, slot: { endsAt: { $gt: this.clock() } } },
      {
        orderBy: { slot: { startsAt: QueryOrder.ASC }, id: QueryOrder.ASC },
        limit: page.pageSize,
        offset: page.offset,
        populate: ['slot'],
      },
    )
    return { items, total }
  }

  /** The current time on the cooperative's clock, for mappers that work out `canLeave`. */
  now(): Date {
    return this.clock()
  }

  /** The member row of a signed-in user. An admin who is not a member gets a 404. */
  async getMemberForUser(userId: string): Promise<Member> {
    const member = await this.em.findOne(Member, { user: userId })
    if (!member) throw new NotFoundException('Member not found')
    return member
  }

  private signUpRefusal(code: SignUpRefusal) {
    const messages: Record<SignUpRefusal, string> = {
      slot_cancelled: 'This slot was cancelled',
      slot_ended: 'This slot has already ended',
      slot_started: 'This slot has already started',
      slot_full: 'This slot is full',
      already_signed_up: 'You are already signed up on this slot',
      overlaps_another_slot: 'This slot overlaps another slot you are signed up on',
    }
    return refusal(code, messages[code])
  }

  private removalRefusal(code: RemovalRefusal) {
    const messages: Record<RemovalRefusal, string> = {
      slot_ended: 'This slot has already ended',
      too_late_to_leave: 'You can only leave a slot that starts in 7 days or more',
    }
    return refusal(code, messages[code])
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
