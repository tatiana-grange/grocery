import { z } from 'zod'

/** A member may leave their own sign-up only while the slot starts in 7 days or more. */
export const LEAVE_NOTICE_DAYS = 7
/** The most places one slot may offer. */
export const MAX_PLACES = 200

/** Refusal codes of a sign-up, read by the client from the 409 body. */
export const SIGN_UP_REFUSALS = [
  'slot_cancelled',
  'slot_ended',
  'slot_started',
  'slot_full',
  'already_signed_up',
  'overlaps_another_slot',
] as const
export const signUpRefusalSchema = z.enum(SIGN_UP_REFUSALS).meta({
  title: 'SignUpRefusal',
  description: 'Why a sign-up was refused. Carried in the 409 body alongside statusCode.',
})
export type SignUpRefusal = z.infer<typeof signUpRefusalSchema>

/** Refusal codes of a removal or a leave, read by the client from the 409 body. */
export const REMOVAL_REFUSALS = ['slot_ended', 'too_late_to_leave'] as const
export const removalRefusalSchema = z.enum(REMOVAL_REFUSALS).meta({
  title: 'RemovalRefusal',
  description:
    'Why a removal or a leave was refused. too_late_to_leave means the slot starts in less ' +
    'than 7 days and the caller is the member. Carried in the 409 body alongside statusCode.',
})
export type RemovalRefusal = z.infer<typeof removalRefusalSchema>

/** Refusal codes of an admin edit, cancel or delete of a slot, read by the client from the 409 body. */
export const SLOT_EDIT_REFUSALS = [
  'slot_ended',
  'slot_has_signups',
  'places_below_signups',
] as const
export const slotEditRefusalSchema = z.enum(SLOT_EDIT_REFUSALS).meta({
  title: 'SlotEditRefusal',
  description: 'Why an admin change to a slot was refused. Carried in the 409 body.',
})
export type SlotEditRefusal = z.infer<typeof slotEditRefusalSchema>
