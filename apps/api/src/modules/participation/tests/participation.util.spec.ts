import { describe, expect, it } from 'vitest'
import {
  canMemberLeave,
  checkRemoval,
  checkSignUp,
  LEAVE_NOTICE_MS,
  getLeaveDeadline,
  doRangesOverlap,
  type SlotFacts,
} from '../participation.util'

const now = new Date('2026-12-01T09:00:00Z')

function slot(overrides: Partial<SlotFacts> = {}): SlotFacts {
  return {
    startsAt: new Date('2026-12-10T09:00:00Z'),
    endsAt: new Date('2026-12-10T12:00:00Z'),
    places: 2,
    isCancelled: false,
    signedUpCount: 0,
    ...overrides,
  }
}

const started = {
  startsAt: new Date('2026-12-01T08:00:00Z'),
  endsAt: new Date('2026-12-01T12:00:00Z'),
}
const ended = {
  startsAt: new Date('2026-12-01T05:00:00Z'),
  endsAt: new Date('2026-12-01T08:00:00Z'),
}

describe('checkSignUp', () => {
  it('refuses a member sign-up on a slot that has already started with slot_started', () => {
    expect(checkSignUp({ slot: slot(started), actor: 'member', now })).toBe('slot_started')
  })

  it('lets a member sign up before the start', () => {
    expect(checkSignUp({ slot: slot(), actor: 'member', now })).toBeNull()
  })

  it('refuses a cancelled slot first, even when it is also full and started', () => {
    const result = checkSignUp({
      slot: slot({ ...started, isCancelled: true, signedUpCount: 2 }),
      actor: 'member',
      now,
    })

    expect(result).toBe('slot_cancelled')
  })

  it.each(['member', 'admin'] as const)(
    'refuses an ended slot with slot_ended for a %s',
    (actor) => {
      expect(checkSignUp({ slot: slot(ended), actor, now })).toBe('slot_ended')
    },
  )

  it.each(['member', 'admin'] as const)('refuses a full slot for a %s', (actor) => {
    expect(checkSignUp({ slot: slot({ signedUpCount: 2 }), actor, now })).toBe('slot_full')
  })

  it('lets an admin sign up on a slot that has started but not ended', () => {
    expect(checkSignUp({ slot: slot(started), actor: 'admin', now })).toBeNull()
  })
})

describe('checkRemoval and canLeave', () => {
  it('lets a member leave at exactly 7 days before the start', () => {
    const exactly = slot({
      startsAt: new Date(now.getTime() + LEAVE_NOTICE_MS),
      endsAt: new Date(now.getTime() + LEAVE_NOTICE_MS + 3_600_000),
    })

    expect(checkRemoval({ slot: exactly, actor: 'member', now })).toBeNull()
    expect(canMemberLeave({ slot: exactly, now })).toBe(true)
  })

  it('refuses a member leaving at 7 days minus 1 ms with too_late_to_leave', () => {
    const late = slot({
      startsAt: new Date(now.getTime() + LEAVE_NOTICE_MS - 1),
      endsAt: new Date(now.getTime() + LEAVE_NOTICE_MS + 3_600_000),
    })

    expect(checkRemoval({ slot: late, actor: 'member', now })).toBe('too_late_to_leave')
    expect(canMemberLeave({ slot: late, now })).toBe(false)
  })

  it('lets an admin remove a member 1 minute before the start', () => {
    const soon = slot({
      startsAt: new Date(now.getTime() + 60_000),
      endsAt: new Date(now.getTime() + 3_600_000),
    })

    expect(checkRemoval({ slot: soon, actor: 'admin', now })).toBeNull()
  })

  it.each(['member', 'admin'] as const)('refuses a removal after the end for a %s', (actor) => {
    expect(checkRemoval({ slot: slot(ended), actor, now })).toBe('slot_ended')
  })

  it('lets a member leave a cancelled slot inside the 7 days', () => {
    const cancelledSoon = slot({
      startsAt: new Date(now.getTime() + 60_000),
      endsAt: new Date(now.getTime() + 3_600_000),
      isCancelled: true,
    })

    expect(checkRemoval({ slot: cancelledSoon, actor: 'member', now })).toBeNull()
  })

  it('puts the leave deadline 7 days before the start', () => {
    const facts = slot()

    expect(getLeaveDeadline(facts).getTime()).toBe(facts.startsAt.getTime() - LEAVE_NOTICE_MS)
  })
})

describe('doRangesOverlap', () => {
  const base = {
    startsAt: new Date('2026-12-10T09:00:00Z'),
    endsAt: new Date('2026-12-10T12:00:00Z'),
  }
  const range = (from: string, to: string) => ({
    startsAt: new Date(`2026-12-10T${from}:00Z`),
    endsAt: new Date(`2026-12-10T${to}:00Z`),
  })

  it('overlaps when one range sits inside the other', () => {
    expect(doRangesOverlap(base, range('10:00', '11:00'))).toBe(true)
  })

  it('overlaps when the ranges are the same', () => {
    expect(doRangesOverlap(base, { ...base })).toBe(true)
  })

  it('overlaps when the ranges partly cover each other', () => {
    expect(doRangesOverlap(base, range('11:00', '14:00'))).toBe(true)
  })

  it('does not overlap when one ends exactly when the other starts', () => {
    expect(doRangesOverlap(base, range('12:00', '14:00'))).toBe(false)
    expect(doRangesOverlap(range('07:00', '09:00'), base)).toBe(false)
  })

  it('does not overlap when the ranges are apart', () => {
    expect(doRangesOverlap(base, range('15:00', '16:00'))).toBe(false)
  })
})
