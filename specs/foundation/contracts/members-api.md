# Contract: Members

REST, following the `posts` controller conventions. Two audiences:

- `/members/me*` — the signed-in member managing their own account (member-scoped guard).
- `/admin/members*` — back office (`@AdminOnly()`).

Schemas below are Zod contract outlines; each carries `.meta({ title, description, examples })`
in the real `*.contract.ts` file, and exports its inferred type.

---

## Enums

```ts
memberStatusSchema = z.enum(['pending', 'active', 'rejected', 'terminated'])
membershipFeeStateSchema = z.enum(['unpaid', 'partly_paid', 'paid'])
membershipPaymentKindSchema = z.enum(['payment', 'adjustment'])
membershipPaymentMethodSchema = z.enum(['cash', 'transfer', 'other'])
userRoleSchema = z.enum(['member', 'admin'])          // 'grocer' added in lot 4
```

---

## Shared response schemas

```ts
memberProfileSchema = z.object({
  addressLine1: z.string().nullish(),
  addressLine2: z.string().nullish(),
  postalCode: z.string().nullish(),
  city: z.string().nullish(),
  phone: z.string().nullish(),
})

feeSummarySchema = z.object({
  expectedAmountCents: z.number().int().nonnegative(),
  paidAmountCents: z.number().int(),
  state: membershipFeeStateSchema,
})

identifierSchema = z.object({
  email: z.string().email().nullish(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullish(),
  phoneNumberVerified: z.boolean(),
})

memberSelfSchema = z.object({
  id: z.string().uuid(),
  membershipNumber: z.string(),
  name: z.string(),
  identifiers: identifierSchema,
  status: memberStatusSchema,
  roles: z.array(userRoleSchema),
  profile: memberProfileSchema,
  fee: feeSummarySchema,
  joinedAt: z.date().nullish(),
  version: z.number().int(),
})

memberListItemSchema = z.object({
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

memberDetailSchema = memberSelfSchema.extend({
  statusHistory: z.array(z.object({
    fromStatus: memberStatusSchema.nullish(),
    toStatus: memberStatusSchema,
    reason: z.string().nullish(),
    changedByName: z.string().nullish(),
    createdAt: z.date(),
  })),
  payments: z.array(z.object({
    id: z.string().uuid(),
    kind: membershipPaymentKindSchema,
    amountCents: z.number().int(),
    method: membershipPaymentMethodSchema,
    paidAt: z.date(),
    note: z.string().nullish(),
    recordedByName: z.string(),
    createdAt: z.date(),
  })),
})
```

---

## Member self-service

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| GET | `/members/me` | member-scoped | Own account: profile, status, roles, fee summary, `membershipNumber` for the QR (FR-011, FR-012, FR-021). |
| PUT | `/members/me/profile` | member-scoped | Update own personal details (FR-011). |
| POST | `/members/me/termination` | member-scoped | Self-terminate (FR / US5 scenario 1). |

`PUT /members/me/profile` request:

```ts
updateMyProfileSchema = memberProfileSchema.partial().extend({
  version: z.number().int(),
})
```

Response: `memberSelfSchema`. Error `409` on stale `version`.

`POST /members/me/termination` request: `z.object({ confirm: z.literal(true) })`.
Response: `memberSelfSchema` (`status = terminated`). Side effect: Better Auth sessions
revoked, so the next request logs the person out.

Password change / reset are Better Auth routes (see auth-roles-api.md), not here.

---

## Back office — membership intake switch

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/membership-intake` | `@AdminOnly()` | Read whether self-registration is open (FR-006). |
| PUT | `/admin/membership-intake` | `@AdminOnly()` | `z.object({ open: z.boolean() })`. |

Stored as a single-row settings record in the `members` module (or a config-backed flag).
When closed, the sign-up `after` hook / a `before` hook rejects new registrations with a
clear message.

---

## Back office — member management

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/members` | `@AdminOnly()` | Paginated list. Filters: `status`, `feeState`, `q` (name / email / phone / membership number), `role`. Sort: `createdAt`, `name`. |
| GET | `/admin/members/:id` | `@AdminOnly()` | `memberDetailSchema` — always returns, any status. |
| POST | `/admin/members` | `@AdminOnly()` | Create a member directly (admin-created path). Creates `user` (via Better Auth admin API) + `member`. |
| PUT | `/admin/members/:id/profile` | `@AdminOnly()` | Edit a member's details. `version` required. |
| POST | `/admin/members/:id/validation` | `@AdminOnly()` | Validate (`pending → active`) or reject (`pending → rejected`). |
| POST | `/admin/members/:id/termination` | `@AdminOnly()` | Terminate (`active → terminated`) with a reason. |
| POST | `/admin/members/:id/reactivation` | `@AdminOnly()` | `terminated → active`, data retained. |
| PUT | `/admin/members/:id/roles` | `@AdminOnly()` | Set roles (see auth-roles-api.md). |

`GET /admin/members` list response: `paginatedSchema(memberListItemSchema)` using
`@lonestone/nzoth/server` pagination helpers (as `posts` does).

`POST /admin/members` request:

```ts
createMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().nullish(),
  phoneNumber: z.string().nullish(),
  profile: memberProfileSchema.partial().optional(),
  roles: z.array(userRoleSchema).min(1).default(['member']),
  status: z.enum(['pending', 'active']).default('active'),
}).refine(d => d.email || d.phoneNumber, 'provide an email address or a phone number')
```

Response `201`: `memberDetailSchema`. Error `409` on an email or phone number already in
use (FR-003).

`POST /admin/members/:id/validation` request:

```ts
memberValidationSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('validate'), version: z.number().int() }),
  z.object({ decision: z.literal('reject'), reason: z.string().min(1), version: z.number().int() }),
])
```

Response: `memberDetailSchema`. Errors: `409` stale version or member not `pending`;
`404` not found. Side effects: sends the decision email; on validate, ensures a
`MembershipFee` exists and sets `joinedAt`.

`POST /admin/members/:id/termination` request:
`z.object({ reason: z.string().min(1), version: z.number().int() })`.
`POST /admin/members/:id/reactivation` request: `z.object({ version: z.number().int() })`.

Every status change writes a `MemberStatusChange` row in the same transaction.

---

## Back office — membership fee

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| PUT | `/admin/members/:id/fee` | `@AdminOnly()` | Set the expected amount (variable fee, FR-019). |
| GET | `/admin/members/:id/fee/payments` | `@AdminOnly()` | List payment + adjustment rows. |
| POST | `/admin/members/:id/fee/payments` | `@AdminOnly()` | Record a payment or an adjustment (FR-020). Append-only. |

`PUT /admin/members/:id/fee` request:
`z.object({ expectedAmountCents: z.number().int().nonnegative(), version: z.number().int() })`.

`POST /admin/members/:id/fee/payments` request:

```ts
recordFeePaymentSchema = z.object({
  kind: membershipPaymentKindSchema.default('payment'),
  amountCents: z.number().int().refine(v => v !== 0, 'amount must be non-zero'),
  method: membershipPaymentMethodSchema,
  paidAt: z.date(),
  note: z.string().nullish(),
}).refine(
  d => d.kind === 'adjustment' || d.amountCents > 0,
  'a payment must be positive; use kind "adjustment" for a correction',
)
```

Response `201`: `feeSummarySchema` (recomputed state). Payment rows are never edited or
deleted — a mistake is a new `adjustment` row.

---

## e2e coverage (`members.controller.e2e-spec.ts`)

Built from `posts.controller.e2e-spec.ts` with `createUserWithSession`:

- sign-up with an email creates a `pending` member; member-scoped route returns `403` while
  pending.
- sign-up with a phone number (OTP verified via the test SMS stub) creates a `pending`
  member the same way.
- admin validates → member can read `/members/me`; `joinedAt` set; fee row exists;
  `identifiers` reflects which one was confirmed.
- creating a member (or signing up) with an email or phone already in use → `409`.
- admin rejects with reason → `403` on member routes; status history has the reason.
- `PUT /members/me/profile` with stale `version` → `409`.
- self-termination → `status = terminated`, subsequent request unauthorised.
- fee: record two partial payments → state goes `unpaid → partly_paid → paid`; an
  `adjustment` row moves it back.
- `PUT /admin/members/:id/roles` removing the last admin → `409`.
- unauthenticated → `401`; non-admin hitting `/admin/members` → `403`.
