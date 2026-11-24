import { Injectable } from '@nestjs/common'
import type {
  AdminSlot,
  AdminSlotDetail,
  AdminSlotList,
  MemberSlot,
  MemberSlotList,
  MySignup,
  MySignupList,
  SlotPagination,
} from './contracts/slot.contract'
import type { SlotSignup } from './entities/slot-signup.entity'
import type { Slot } from './entities/slot.entity'
import { canMemberLeave, getLeaveDeadline, toRemovalFacts } from './participation.util'

interface PageOf<T> {
  total: number
  pagination: SlotPagination
  items: T[]
}

/** Turns slot entities into the contracts the controllers return. */
@Injectable()
export class ParticipationMapper {
  /** The sign-ups must be loaded: the counts are read from them. */
  toAdminSlot(slot: Slot): AdminSlot {
    // Sign-ups not loaded: report none rather than throw, as purchasing.mapper does for its collections.
    const signedUpCount = slot.signups.isInitialized() ? slot.signups.getItems().length : 0
    const { isCancelled } = toRemovalFacts(slot)
    return {
      id: slot.id,
      roleLabel: slot.roleLabel,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      places: slot.places,
      signedUpCount,
      freePlaces: isCancelled ? 0 : Math.max(slot.places - signedUpCount, 0),
      isCancelled,
      cancelledAt: slot.cancelledAt ?? null,
    }
  }

  toAdminSlotList({ items, total, pagination }: PageOf<Slot>): AdminSlotList {
    return {
      data: items.map((slot) => this.toAdminSlot(slot)),
      meta: this.toMeta(total, pagination),
    }
  }

  toMemberSlotList({
    items,
    total,
    pagination,
    memberId,
  }: PageOf<Slot> & { memberId: string }): MemberSlotList {
    return {
      data: items.map((slot) => this.toMemberSlot(slot, memberId)),
      meta: this.toMeta(total, pagination),
    }
  }

  toMySignupList({
    items,
    total,
    pagination,
    now,
  }: PageOf<SlotSignup> & { now: Date }): MySignupList {
    return {
      data: items.map((signup) => this.toMySignup(signup, now)),
      meta: this.toMeta(total, pagination),
    }
  }

  private toMeta(total: number, pagination: SlotPagination): AdminSlotList['meta'] {
    return {
      itemCount: total,
      pageSize: pagination.pageSize,
      offset: pagination.offset,
      hasMore: pagination.offset + pagination.pageSize < total,
    }
  }

  /** The members behind the sign-ups must be loaded too, with their user. */
  toAdminSlotDetail(slot: Slot): AdminSlotDetail {
    const signups = [...(slot.signups.isInitialized() ? slot.signups.getItems() : [])]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((signup) => ({
        memberId: signup.member.id,
        memberName: signup.member.user.name,
        membershipNumber: signup.member.membershipNumber,
        signedUpAt: signup.createdAt,
      }))
    return { ...this.toAdminSlot(slot), signups }
  }

  /** The sign-ups must be loaded: the counts and `isSignedUp` are read from them. */
  toMemberSlot(slot: Slot, memberId: string): MemberSlot {
    return {
      ...this.toAdminSlot(slot),
      isSignedUp: slot.signups.isInitialized()
        ? slot.signups.getItems().some((signup) => signup.member.id === memberId)
        : false,
    }
  }

  /** The slot of the sign-up must be loaded. `now` is the clock the leave rule reads. */
  toMySignup(signup: SlotSignup, now: Date): MySignup {
    const { slot } = signup
    const facts = toRemovalFacts(slot)
    return {
      slotId: slot.id,
      roleLabel: slot.roleLabel,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      isCancelled: facts.isCancelled,
      canLeave: canMemberLeave({ slot: facts, now }),
      leaveDeadline: getLeaveDeadline(slot),
    }
  }
}
