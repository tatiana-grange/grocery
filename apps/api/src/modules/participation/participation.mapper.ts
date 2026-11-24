import { Injectable } from '@nestjs/common'
import type { AdminSlot, AdminSlotDetail } from './contracts/slot.contract'
import type { Slot } from './entities/slot.entity'

/** Turns slot entities into the contracts the controllers return. */
@Injectable()
export class ParticipationMapper {
  /** The sign-ups must be loaded: the counts are read from them. */
  toAdminSlot(slot: Slot): AdminSlot {
    const signedUpCount = slot.signups.getItems().length
    const isCancelled = slot.cancelledAt != null
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

  /** The members behind the sign-ups must be loaded too, with their user. */
  toAdminSlotDetail(slot: Slot): AdminSlotDetail {
    const signups = [...slot.signups.getItems()]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((signup) => ({
        memberId: signup.member.id,
        memberName: signup.member.user.name,
        membershipNumber: signup.member.membershipNumber,
        signedUpAt: signup.createdAt,
      }))
    return { ...this.toAdminSlot(slot), signups }
  }
}
