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
