import { createPaginationQuerySchema, paginatedSchema } from '@lonestone/nzoth/server'
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

const slotBaseShape = {
  id: z.string().uuid(),
  roleLabel: z.string(),
  startsAt: z.date(),
  endsAt: z.date(),
  places: z.number().int(),
  /** Sign-ups held on the slot, cancelled or not. */
  signedUpCount: z.number().int(),
  /** `places` minus `signedUpCount`, never below 0, and 0 on a cancelled slot. */
  freePlaces: z.number().int(),
  isCancelled: z.boolean(),
  cancelledAt: z.date().nullish(),
}

export const adminSlotSchema = z.object(slotBaseShape).meta({
  title: 'AdminSlot',
  description: 'A participation slot as the back office sees it, with its counts.',
})
export type AdminSlot = z.infer<typeof adminSlotSchema>

export const slotSignupSchema = z
  .object({
    memberId: z.string().uuid(),
    memberName: z.string(),
    membershipNumber: z.string(),
    signedUpAt: z.date(),
  })
  .meta({ title: 'SlotSignup', description: 'One member signed up on a slot.' })
export type SlotSignup = z.infer<typeof slotSignupSchema>

export const adminSlotDetailSchema = z
  .object({ ...slotBaseShape, signups: z.array(slotSignupSchema) })
  .meta({
    title: 'AdminSlotDetail',
    description: 'A slot with the members signed up on it, oldest sign-up first.',
  })
export type AdminSlotDetail = z.infer<typeof adminSlotDetailSchema>

export const memberSlotSchema = z.object({ ...slotBaseShape, isSignedUp: z.boolean() }).meta({
  title: 'MemberSlot',
  description: 'A participation slot as a member sees it, with whether they are on it.',
})
export type MemberSlot = z.infer<typeof memberSlotSchema>

export const mySignupSchema = z
  .object({
    slotId: z.string().uuid(),
    roleLabel: z.string(),
    startsAt: z.date(),
    endsAt: z.date(),
    isCancelled: z.boolean(),
    /** Whether the member may leave now. Decided by the server, never re-derived by the screen. */
    canLeave: z.boolean(),
    /** 7 days before the start: the last moment to leave a live slot. */
    leaveDeadline: z.date(),
  })
  .meta({ title: 'MySignup', description: 'One of the caller’s own sign-ups.' })
export type MySignup = z.infer<typeof mySignupSchema>

export const slotInputSchema = adminSlotSchema
  .pick({ roleLabel: true, startsAt: true, endsAt: true, places: true })
  .extend({
    roleLabel: adminSlotSchema.shape.roleLabel.trim().min(1).max(120),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    places: adminSlotSchema.shape.places.min(1).max(MAX_PLACES),
  })
  .refine((slot) => slot.endsAt > slot.startsAt, {
    message: 'The slot must end after it starts',
    path: ['endsAt'],
  })
  .meta({
    title: 'SlotInput',
    description:
      'A slot to create or to replace. The role label is 1 to 120 characters, places are 1 to ' +
      '200, and the end must be after the start. Cancelling is a separate route.',
    examples: [
      {
        roleLabel: 'Run the distribution',
        startsAt: '2026-12-10T09:00:00.000Z',
        endsAt: '2026-12-10T12:00:00.000Z',
        places: 3,
      },
    ],
  })
export type SlotInput = z.infer<typeof slotInputSchema>

export const signUpMemberSchema = z
  .object({ memberId: z.string().uuid() })
  .meta({ title: 'SignUpMemberInput', description: 'The member an admin signs up on a slot.' })
export type SignUpMemberInput = z.infer<typeof signUpMemberSchema>

export const adminSlotListSchema = paginatedSchema(adminSlotSchema).meta({
  title: 'AdminSlotList',
  description: 'A paginated page of slots, earliest start first',
})
export const memberSlotListSchema = paginatedSchema(memberSlotSchema).meta({
  title: 'MemberSlotList',
  description: 'A paginated page of coming slots, earliest start first',
})
export const mySignupListSchema = paginatedSchema(mySignupSchema).meta({
  title: 'MySignupList',
  description: 'A paginated page of the caller’s coming sign-ups, earliest start first',
})

export const slotPaginationSchema = createPaginationQuerySchema({ defaultPageSize: 50 })
export type SlotPagination = z.infer<typeof slotPaginationSchema>

export const includePastSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true')
  .meta({
    title: 'IncludePast',
    description: 'When true, slots that have already ended are listed too. Default false.',
  })
