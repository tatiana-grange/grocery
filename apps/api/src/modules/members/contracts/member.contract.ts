import {
  createFilterQueryStringSchema,
  createPaginationQuerySchema,
  createSortingQueryStringSchema,
  paginatedSchema,
} from '@lonestone/nzoth/server'
import { z } from 'zod'

// -------------------------------------------------------------------------------------------------
// Enums (kept in the contract, exposed via .meta() so the frontends can render pickers)
// -------------------------------------------------------------------------------------------------

export const MEMBER_STATUSES = ['pending', 'active', 'rejected', 'terminated'] as const
export const memberStatusSchema = z.enum(MEMBER_STATUSES).meta({
  title: 'MemberStatus',
  description: 'Lifecycle status of a cooperative member',
})
export type MemberStatus = z.infer<typeof memberStatusSchema>

export const MEMBERSHIP_FEE_STATES = ['unpaid', 'partly_paid', 'paid'] as const
export const membershipFeeStateSchema = z.enum(MEMBERSHIP_FEE_STATES).meta({
  title: 'MembershipFeeState',
  description: 'Derived from the sum of recorded payments against the expected amount',
})
export type MembershipFeeState = z.infer<typeof membershipFeeStateSchema>

export const MEMBERSHIP_PAYMENT_KINDS = ['payment', 'adjustment'] as const
export const membershipPaymentKindSchema = z.enum(MEMBERSHIP_PAYMENT_KINDS).meta({
  title: 'MembershipPaymentKind',
  description: 'A correction is recorded as an "adjustment" row, never by editing a payment',
})
export type MembershipPaymentKind = z.infer<typeof membershipPaymentKindSchema>

export const MEMBERSHIP_PAYMENT_METHODS = ['cash', 'transfer', 'other'] as const
export const membershipPaymentMethodSchema = z.enum(MEMBERSHIP_PAYMENT_METHODS).meta({
  title: 'MembershipPaymentMethod',
  description: 'How a membership-fee payment was made ("online" is reserved for lot 5)',
})
export type MembershipPaymentMethod = z.infer<typeof membershipPaymentMethodSchema>

export const USER_ROLES = ['member', 'admin'] as const
export const userRoleSchema = z.enum(USER_ROLES).meta({
  title: 'UserRole',
  description: 'Access role. "admin" is a superset of "member". "grocer" is added in lot 4.',
})
export type UserRole = z.infer<typeof userRoleSchema>

// -------------------------------------------------------------------------------------------------
// Shared response schemas
// -------------------------------------------------------------------------------------------------

export const memberProfileSchema = z
  .object({
    addressLine1: z.string().nullish(),
    addressLine2: z.string().nullish(),
    postalCode: z.string().nullish(),
    city: z.string().nullish(),
    phone: z.string().nullish(),
  })
  .meta({ title: 'MemberProfile', description: 'A member’s editable personal details' })

export type MemberProfile = z.infer<typeof memberProfileSchema>

export const memberIdentifiersSchema = z
  .object({
    email: z.string().email().nullish(),
    emailVerified: z.boolean(),
    phoneNumber: z.string().nullish(),
    phoneNumberVerified: z.boolean(),
  })
  .meta({ title: 'MemberIdentifiers', description: 'The email and/or phone the account signs in with' })

export type MemberIdentifiers = z.infer<typeof memberIdentifiersSchema>

export const feeSummarySchema = z
  .object({
    expectedAmountCents: z.number().int().nonnegative(),
    paidAmountCents: z.number().int(),
    state: membershipFeeStateSchema,
  })
  .meta({ title: 'FeeSummary', description: 'Membership-fee expectation, total paid, and derived state' })

export type FeeSummary = z.infer<typeof feeSummarySchema>

export const memberSelfSchema = z
  .object({
    id: z.string().uuid(),
    membershipNumber: z.string(),
    name: z.string(),
    identifiers: memberIdentifiersSchema,
    status: memberStatusSchema,
    roles: z.array(userRoleSchema),
    profile: memberProfileSchema,
    fee: feeSummarySchema,
    joinedAt: z.date().nullish(),
    version: z.number().int(),
  })
  .meta({ title: 'MemberSelf', description: 'The signed-in member’s own account' })

export type MemberSelf = z.infer<typeof memberSelfSchema>

export const memberStatusChangeSchema = z
  .object({
    fromStatus: memberStatusSchema.nullish(),
    toStatus: memberStatusSchema,
    reason: z.string().nullish(),
    changedByName: z.string().nullish(),
    createdAt: z.date(),
  })
  .meta({ title: 'MemberStatusChange', description: 'One entry in a member’s status history' })

export const memberPaymentSchema = z
  .object({
    id: z.string().uuid(),
    kind: membershipPaymentKindSchema,
    amountCents: z.number().int(),
    method: membershipPaymentMethodSchema,
    paidAt: z.date(),
    note: z.string().nullish(),
    recordedByName: z.string(),
    createdAt: z.date(),
  })
  .meta({ title: 'MemberPayment', description: 'One recorded membership-fee payment or adjustment' })

export const memberDetailSchema = memberSelfSchema
  .extend({
    statusHistory: z.array(memberStatusChangeSchema),
    payments: z.array(memberPaymentSchema),
  })
  .meta({ title: 'MemberDetail', description: 'Full back-office view of a member' })

export type MemberDetail = z.infer<typeof memberDetailSchema>

export const memberListItemSchema = z
  .object({
    id: z.string().uuid(),
    membershipNumber: z.string(),
    name: z.string(),
    email: z.string().email().nullish(),
    phoneNumber: z.string().nullish(),
    status: memberStatusSchema,
    roles: z.array(userRoleSchema),
    feeState: membershipFeeStateSchema,
    createdAt: z.date(),
  })
  .meta({ title: 'MemberListItem', description: 'A member as shown in the back-office list' })

export type MemberListItem = z.infer<typeof memberListItemSchema>

export const membersListSchema = paginatedSchema(memberListItemSchema).meta({
  title: 'MembersList',
  description: 'A paginated list of members',
})

export type MembersList = z.infer<typeof membersListSchema>

// -------------------------------------------------------------------------------------------------
// Back-office actions
// -------------------------------------------------------------------------------------------------

export const memberValidationSchema = z
  .discriminatedUnion('decision', [
    z.object({ decision: z.literal('validate'), version: z.number().int() }),
    z.object({
      decision: z.literal('reject'),
      reason: z.string().min(1),
      version: z.number().int(),
    }),
  ])
  .meta({
    title: 'MemberValidation',
    description: 'Validate a pending member (moves them to active) or reject them with a reason',
    examples: [{ decision: 'validate', version: 0 }],
  })

export type MemberValidationInput = z.infer<typeof memberValidationSchema>

export const membershipIntakeSchema = z
  .object({ open: z.boolean() })
  .meta({
    title: 'MembershipIntake',
    description: 'Whether self-registration is currently accepted',
    examples: [{ open: true }],
  })

export type MembershipIntakeInput = z.infer<typeof membershipIntakeSchema>

// -------------------------------------------------------------------------------------------------
// Self-service and fee management
// -------------------------------------------------------------------------------------------------

export const updateProfileSchema = memberProfileSchema
  .partial()
  .extend({ version: z.number().int() })
  .meta({
    title: 'UpdateMemberProfile',
    description: 'Update a member’s personal details (send the version you loaded)',
    examples: [{ city: 'Nantes', phone: '+33612345678', version: 1 }],
  })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const setFeeSchema = z
  .object({
    expectedAmountCents: z.number().int().nonnegative(),
    version: z.number().int(),
  })
  .meta({
    title: 'SetMembershipFee',
    description: 'Set the expected membership fee for a member (the "variable fee")',
    examples: [{ expectedAmountCents: 2000, version: 1 }],
  })

export type SetFeeInput = z.infer<typeof setFeeSchema>

export const recordFeePaymentSchema = z
  .object({
    kind: membershipPaymentKindSchema.default('payment'),
    amountCents: z.number().int().refine((value) => value !== 0, 'amount must be non-zero'),
    method: membershipPaymentMethodSchema,
    paidAt: z.coerce.date(),
    note: z.string().nullish(),
  })
  .refine(
    (data) => data.kind === 'adjustment' || data.amountCents > 0,
    'a payment must be positive; use kind "adjustment" for a correction',
  )
  .meta({
    title: 'RecordFeePayment',
    description: 'Record a membership-fee payment (positive) or an adjustment (any non-zero)',
    examples: [{ kind: 'payment', amountCents: 1000, method: 'cash', paidAt: '2026-09-02' }],
  })

export type RecordFeePaymentInput = z.infer<typeof recordFeePaymentSchema>

export const feePaymentsListSchema = z.array(memberPaymentSchema).meta({
  title: 'FeePaymentsList',
  description: 'All recorded payments and adjustments against a member’s fee',
})

// -------------------------------------------------------------------------------------------------
// List query params
// -------------------------------------------------------------------------------------------------

export const enabledMemberSortingKeys = ['createdAt', 'name'] as const
export const memberSortingSchema = createSortingQueryStringSchema(enabledMemberSortingKeys)
export type MemberSorting = z.infer<typeof memberSortingSchema>

export const enabledMemberFilteringKeys = ['status', 'feeState', 'role', 'q'] as const
export const memberFilteringSchema = createFilterQueryStringSchema(enabledMemberFilteringKeys)
export type MemberFiltering = z.infer<typeof memberFilteringSchema>

export const memberPaginationSchema = createPaginationQuerySchema()
export type MemberPagination = z.infer<typeof memberPaginationSchema>
