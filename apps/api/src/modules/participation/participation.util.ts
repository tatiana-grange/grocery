import {
  LEAVE_NOTICE_DAYS,
  type RemovalRefusal,
  type SignUpRefusal,
} from './contracts/slot.contract'

export interface TimeRange {
  startsAt: Date
  endsAt: Date
}

/** What the sign-up rules need to know about a slot. Nothing here reads the database. */
export interface SlotFacts extends TimeRange {
  places: number
  isCancelled: boolean
  signedUpCount: number
}

/** What the removal rules need: a removal never looks at the places. */
export type RemovalFacts = TimeRange & Pick<SlotFacts, 'isCancelled'>

export type Actor = 'member' | 'admin'

export const LEAVE_NOTICE_MS = LEAVE_NOTICE_DAYS * 24 * 60 * 60 * 1000

export const SLOT_ENDED_MESSAGE = 'This slot has already ended'

/** The facts every rule reads from a slot row. */
export function toRemovalFacts(slot: {
  startsAt: Date
  endsAt: Date
  cancelledAt?: Date | null
}): RemovalFacts {
  return { startsAt: slot.startsAt, endsAt: slot.endsAt, isCancelled: slot.cancelledAt != null }
}

export function hasEnded(slot: Pick<TimeRange, 'endsAt'>, now: Date): boolean {
  return now >= slot.endsAt
}

/**
 * The refusals that need only the slot and the clock, first match wins. `already_signed_up` and
 * `overlaps_another_slot` need the database, so the service decides them after this call.
 *
 * An admin skips the started check (any time before the slot ends) and never skips the full
 * check.
 */
export function checkSignUp(input: {
  slot: SlotFacts
  actor: Actor
  now: Date
}): SignUpRefusal | null {
  const { slot, actor, now } = input
  if (slot.isCancelled) return 'slot_cancelled'
  if (hasEnded(slot, now)) return 'slot_ended'
  if (actor === 'member' && now >= slot.startsAt) return 'slot_started'
  if (slot.signedUpCount >= slot.places) return 'slot_full'
  return null
}

/** Whether a sign-up may be removed, or the reason it may not. */
export function checkRemoval(input: {
  slot: RemovalFacts
  actor: Actor
  now: Date
}): RemovalRefusal | null {
  const { slot, actor, now } = input
  if (hasEnded(slot, now)) return 'slot_ended'
  if (actor === 'admin') return null
  if (slot.isCancelled) return null
  if (slot.startsAt.getTime() - now.getTime() >= LEAVE_NOTICE_MS) return null
  return 'too_late_to_leave'
}

/** Whether a member may leave their own sign-up now. Same rule as `checkRemoval` for a member. */
export function canMemberLeave(input: { slot: RemovalFacts; now: Date }): boolean {
  return checkRemoval({ ...input, actor: 'member' }) === null
}

/** The last moment a member may leave a live slot: 7 days before it starts. */
export function getLeaveDeadline(slot: { startsAt: Date }): Date {
  return new Date(slot.startsAt.getTime() - LEAVE_NOTICE_MS)
}
