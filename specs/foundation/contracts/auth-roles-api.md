# Contract: Authentication & Roles

Better Auth owns `/auth/*` (sign-up, sign-in, sign-out, verification, password reset,
change password). Lot 1 adds two plugins — **admin** (roles) and **phoneNumber** (phone
identifier) — and a thin role-admin surface in the `members` module. Nothing here
re-implements auth.

## Identifiers: email or phone number

A person registers with a name, a password, and **one** identifier:

| Identifier | Sign-up route | Confirmation | Sign-in route |
| --- | --- | --- | --- |
| Email | `POST /auth/sign-up/email` (`name`, `email`, `password`) | verification link email (existing wiring) | `POST /auth/sign-in/email` |
| Phone | `POST /auth/sign-up/email` with `phoneNumber` **or** the phoneNumber plugin's sign-up route (`name`, `phoneNumber`, `password`) | one-time code by SMS (`POST /auth/phone-number/send-otp`, `POST /auth/phone-number/verify`) | `POST /auth/sign-in/phone-number` |

- `autoSignIn` stays `false`: confirm the identifier, then an admin validates, then sign-in
  works.
- One account per identifier — email uniqueness is Better Auth's default, phone uniqueness
  is enforced by the phoneNumber plugin (FR-003). A duplicate returns an error the SPA
  shows plainly.
- OTP delivery goes through `SmsService` (console in dev, provider in prod).
- Password reset: `POST /auth/forget-password` (email link) or the phoneNumber plugin's
  OTP-based reset (code by SMS) — FR-009.

An `after` hook on the sign-up route creates the `member` row (`status = pending`) and the
first `MemberStatusChange`, in one transaction.

## Better Auth endpoints used as-is

| Purpose | Route | Notes |
| --- | --- | --- |
| Verify email | `GET /auth/verify-email?token=` | SPA page `/verify-email`. |
| Verify phone | `POST /auth/phone-number/verify` | SPA "enter the code" step. |
| Change password | `POST /auth/change-password` | requires current password (FR-010). |
| Sign out | `POST /auth/sign-out` | |

## Guard behaviour (`AuthGuard`, extended)

| Route marking | Rule |
| --- | --- |
| `@Public()` | no session needed (unchanged) |
| default (authenticated) | valid session required |
| member-scoped (`/members/me...`) | session + a confirmed identifier (`emailVerified` or `phoneNumberVerified`) + linked `member.status === 'active'` |
| `@AdminOnly()` | `role` contains `admin` |

`admin` passes every member-scoped check (it is a superset of `member`) and is **not**
blocked by member status. A `pending` / `rejected` / `terminated` member hitting a
member-scoped route gets `403` with a status-specific message.

`@Roles(...)` exists as a generic decorator so the `grocer` role can be added in lot 4
without touching the guard shape; lot 1 only uses `@AdminOnly()`.

## Role administration (in `members` module, `@AdminOnly()`)

### `PUT /admin/members/:id/roles`

Set the full role set for a member.

```ts
setMemberRolesSchema = z.object({
  roles: z.array(z.enum(['member', 'admin'])).min(1),   // 'member' is always implied; sending ['admin'] adds admin
  version: z.number().int(),                             // optimistic lock on the member row
}).meta({
  title: 'SetMemberRoles',
  description: 'Replace the set of access roles for a member. Every member keeps the member role; adding admin grants back-office access.',
  examples: [{ roles: ['member', 'admin'], version: 3 }],
})
```

Response: `MemberDetail` (see members-api.md) with the new `roles`.

Errors:
- `409` — `version` stale, **or** removing `admin` from the last remaining admin (FR-018);
  the message distinguishes the two.
- `404` — member not found.

## Enum exposed

`UserRole = ['member', 'admin']` — defined in the `members` contract, surfaced via `.meta()`
so the SPA can render the admin toggle. (`grocer` is added to this enum in lot 4.)
