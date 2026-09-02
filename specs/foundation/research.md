# Phase 0 Research: Foundation

Design decisions for lot 1. The stack itself is fixed by the constitution and the
boilerplate, so every item here is a "how", not a "which library".

Reviewer input on the draft plan (2026-09-01):

- Sign-up must work with **email or phone number** (items 1–2).
- **No grocer role** in lot 1 and no supplier login accounts. An admin is a "member plus":
  everything a member can do, plus administration (item 1).
- Member data lives in a **separate table**, not on the auth `user` row (item 3).

---

## 1. Roles: `member` and `admin` only

**Decision**: Add the Better Auth `admin` plugin to `auth.config.ts` with
`admin({ defaultRole: 'member', adminRoles: ['admin'] })`. Two role values in lot 1:
`member` (everyone) and `admin`. `admin` is a strict superset — an admin account also has a
`member` row and every member capability; the `role` column just adds `admin`.
`AuthGuard` treats `admin` as passing every member-scoped check plus the `@AdminOnly()`
check. The `@Roles(...)` decorator is written generically so the future `grocer` role (lot
4, distribution) is a one-line addition.

**Rationale**: The cooperative does not yet want people staffing distributions to have
special accounts, and suppliers are catalogue data, not users. Two roles cover lot 1
exactly. The admin addon guide (`apps/documentation/.../addons/better-auth-admin.mdx`) is
the sanctioned path and only touches the `auth` folder.

**Alternatives considered**:
- Implement `grocer` now, unused — dead surface area and dead UI; the constitution allows a
  smaller scope than its full role list.
- Better Auth **organizations** plugin — explicitly out of scope (constitution V).
- A role join table in `members` — splits identity across modules for no lot-1 benefit.

**Last-admin protection** (FR-018): `MembersService.setRoles` refuses to drop `admin` from
the only account that has it.

---

## 2. Sign-up and sign-in with email or phone number

**Decision**: Add the Better Auth `phoneNumber` plugin. The `user` table gains
`phoneNumber` (unique, nullable) and `phoneNumberVerified`. A person registers with a name,
a password, and **one** identifier — an email address or a phone number:

- Email path: existing `sendOnSignUp` verification link (unchanged).
- Phone path: the plugin sends a one-time code; the SPA has a "enter the code" step.

Delivery of the SMS code goes through a new thin `SmsService` in the `auth` module,
mirroring how `auth.module.ts` wires `EmailService` into `sendVerificationEmail`. In
development `SmsService` logs the code (same spirit as MailDev for email); in production it
calls a provider (choice deferred — an infra task, not this spec). One account per
identifier: the plugin enforces phone uniqueness, Better Auth already enforces email
uniqueness (FR-003).

A member may later add the other identifier from their account page (nice to have; the
contract leaves room but the SPA screen can come in a follow-up). Password reset works from
either: link by email, code by phone (FR-009).

**Rationale**: Directly answers the reviewer. The `phoneNumber` plugin is the maintained
Better Auth way to do this and keeps the auth module the single owner of identity.

**Alternatives considered**:
- Store the phone number only on the `member` row and treat email as the sole login — does
  not meet "sign in via phone".
- A custom credential provider — reinvents what the plugin gives us, including OTP storage
  and rate limiting.
- Email-only for lot 1, phone later — rejected by the reviewer.

**Open follow-up (not blocking the spec)**: production SMS provider selection, sender ID,
per-country formatting, and cost controls.

---

## 3. Cooperative member data lives in a separate table

**Decision** (reviewer-confirmed): Keep the `user` table auth-owned (name, email,
emailVerified, phoneNumber, phoneNumberVerified, image, role, banned, ban*). Add a `member`
table in the `members` module with a **one-to-one, non-nullable** FK to `user.id`, holding:
postal address, phone (display/contact copy), `status`, join date, `membershipNumber`, and
a `version` column for optimistic concurrency. Status history and fee data hang off
`member`. Every user has exactly one `member` row, admins included.

**Rationale**: Better Auth regenerates the auth schema from its own field list
(`auth:generate`); piling domain columns onto `user` invites drift and merge pain. A
dedicated table keeps the reference-pattern module self-contained and lets `members` own
its migrations. The one-to-one link honours "a member and a user account are the same
person".

**Alternatives considered**:
- All fields on `user` via Better Auth `additionalFields` — tight coupling, codegen noise,
  and the `members` module would have no entity of its own. Rejected by the reviewer.
- `member` with a PK unrelated to `user` — loses the natural 1:1.

**Creation flow**: a Better Auth `after` hook on the sign-up route creates the `member` row
with `status = 'pending'` and writes the first `MemberStatusChange`, in one transaction.
The default-admin seeder creates user + member + `role = 'admin'` + `status = 'active'`.

---

## 4. Gating sign-in on member status

**Decision**: Better Auth still issues a session on valid credentials. Authorisation is
enforced in `AuthGuard`: after resolving the session, load the linked `member`. For
member-scoped routes, require `member.status === 'active'` and a confirmed identifier
(`emailVerified` or `phoneNumberVerified`). `@AdminOnly()` routes require `role` to contain
`admin` and are **not** blocked by member status (a suspended member who is also an admin
can still administer — a deliberate call; revisit if the cooperative disagrees).

**Rationale**: Keeps Better Auth unmodified and puts the domain rule where the codebase
already does authorisation. One extra query per request, cached on `request` for the
handler.

**Alternatives considered**:
- Better Auth `banned` flag for "pending" — semantically wrong and fights the admin
  plugin's real ban feature.
- A custom plugin hook that refuses session creation — more moving parts, and the guard is
  still needed for the `admin` check.

On termination, Better Auth sessions are revoked in addition to the status flip, so a
terminated member is signed out promptly.

---

## 5. Product price history

**Decision**: `product_price` rows are append-only, each with `validFrom` and nullable
`validTo`. Setting a new price in one transaction: close the current open row
(`validTo = now`) and insert a new open row (`validFrom = now`, `validTo = null`). The
"current price" is the row with `validTo IS NULL`. No price column on `product`.

**Rationale**: Directly satisfies FR-030 and the immutable-ledger spirit (principle II).
Windowed history also answers "what did this cost on date X", which purchasing and
accounting need later.

**Alternatives considered**:
- `price` on `product` plus a `product_price_history` audit table — two sources of truth.
- Only `validFrom`, order by date for "current" — works, but an explicit `validTo IS NULL`
  index makes the hot query trivial and guards against future-dated prices.

**Amount storage**: integer minor units (cents) plus a `currency` field fixed to `EUR` for
now, to avoid floating-point money. A Zod transform exposes decimals at the contract edge.

---

## 6. By-weight pricing

**Decision**: `product.saleMode` enum: `unit` | `weight`. For `weight`, the price row's
amount is per kilogram and `product.pricingUnit` is `kg`; for `unit` it is `piece`. Add
now-unused-but-reserved nullable fields the later lots need:
`product.averageWeightGrams` and `product.weightTolerancePercent`. Order/reception quantity
divergence is a lot 3 concern; lot 1 only needs the price expressed correctly.

**Rationale**: FR-028/FR-029 need the mode and the per-kg semantics now. Reserving the two
weight fields avoids a migration when lot 3 arrives, at the cost of two nullable columns.

**Alternatives considered**:
- A separate `weighted_product` subtype table — over-engineered for two fields.
- Inferring mode from `pricingUnit` alone — less explicit; a dedicated `saleMode` enum
  reads better in the UI and contracts.

---

## 7. Archiving strategy

**Decision**: Soft archive. `supplier`, `product`, and `category` each get
`archivedAt: Date | null`. List endpoints default to `archivedAt IS NULL`; a
`?includeArchived=true` query param widens them for history/detail screens. Detail
(`GET /:id`) always returns the row regardless of archive state. Archiving a supplier with
active products returns `409 Conflict` with the count unless `?cascade=true` is passed, in
which case the supplier and its products are archived in one transaction (FR-024).
Categories cannot be removed while non-archived products reference them — reassign first
(FR-026); "removal" of a category is also an archive, not a delete.

**Rationale**: No hard deletes keeps every past order/reception reference valid in later
lots. A single nullable timestamp is the least surprising soft-delete shape and doubles as
"when was it archived".

**Alternatives considered**:
- A global MikroORM soft-delete filter — hides rows too aggressively; the detail and
  history views need them and a global filter is easy to forget to bypass.
- Hard delete with `ON DELETE RESTRICT` — loses history, fails the spec.

---

## 8. Optimistic concurrency

**Decision**: Add an integer `version` column to `member`, `product`, `supplier`, and
`membership_fee`, using MikroORM's `@Property({ version: true })`. Update contracts require
the client to send the `version` it loaded; the service throws `409 Conflict` ("this record
changed since you opened it") when it does not match. The SPA surfaces a reload prompt.

**Rationale**: FR-034 asks for exactly this. MikroORM has first-class optimistic locking
via a version field, so it is a decorator plus a caught error.

**Alternatives considered**:
- `updatedAt` comparison — coarser and clock-sensitive.
- Last-write-wins with an audit log — silently loses an edit, which the spec forbids.

---

## 9. Membership-fee model

**Decision**: One `membership_fee` row per member, carrying `expectedAmountCents` (seeded
from a config default `MEMBERSHIP_FEE_DEFAULT_CENTS`, overridable per member — the
"variable fee", FR-019). Payments are append-only `membership_payment` rows (`amountCents`,
`paidAt`, `method` enum `cash|transfer|other`, `note`, and a `kind` enum
`payment|adjustment` so a correction is a negative-amount `adjustment` row, not an edit).
Fee **state** is derived: sum of payment rows vs `expectedAmountCents` →
`unpaid` | `partly_paid` | `paid`.

**Rationale**: Matches FR-019–FR-021 and the immutable-ledger discipline. Derived state can
never disagree with the payment rows. Online payment (lot 5) adds a `method = 'online'` and
a provider reference without reshaping this.

**Alternatives considered**:
- A stored `feeState` column updated on each payment — a second source of truth.
- Folding fee payments into the future `wallet` ledger — the wallet does not exist in lot 1
  and the membership fee is conceptually separate from the spending balance.

---

## 10. Confirmation and notification messages

**Decision**: Reuse `EmailService` and Better Auth's existing verification / reset wiring
for the email path. Add `SmsService` (item 2) for the phone path, wired the same way.
Admin-decision notifications (validated / rejected / terminated) are sent from
`MembersService` to the member's confirmed identifier — email or SMS — with
`@grocery/i18n`-sourced text. `emailVerification.sendOnSignUp` is already `true`;
`autoSignIn` is already `false`, which matches "confirm, then an admin validates, then you
can sign in".

**Rationale**: Minimal new infrastructure; the auth module already demonstrates the email
pattern and `SmsService` mirrors it.

**Alternatives considered**:
- A dedicated notification module / queue — out of proportion for lot 1 volume.
- React-email templates — the boilerplate ships plain strings; keep parity, revisit
  project-wide.

---

## 11. Personal QR code

**Decision**: The QR encodes the member's `membershipNumber` (a short, stable, opaque
string generated at member creation — e.g. `MEM-000123`), not the raw UUID and not
personal data. Rendered **client-side** in the SPA from the value returned by
`GET /members/me`, using a small QR component in `features/members/`. The distribution
screen (lot 4) will look a member up by `membershipNumber`.

**Rationale**: Keeps PII out of the code, keeps the API returning data not images, and
`membershipNumber` is the natural scan key for lot 4. Client rendering avoids an image
endpoint and caching concerns.

**Alternatives considered**:
- Server-generated PNG endpoint — extra route, binary response, caching headers, no gain.
- Encoding a signed token — useful only if the QR authenticated something; it does not.

---

## Cross-cutting notes

- **Schema workflow**: while `members` and `catalog` schemas are still moving, use
  `pnpm --filter=api db:fresh:seed`. Generate the initial migration for the lot only once
  the entities settle, and review the SQL (MikroORM can emit DROP+ADD for renames). Note
  the auth `user` table changes come from Better Auth plugins — run `pnpm --filter=api
  auth:generate` to refresh the auth entity/schema before generating the app migration.
- **Seeders**: `auth.seeder.ts` (or `members.seeder.ts`) seeds one `admin` (user + member
  row) so a fresh database is usable. `catalog.seeder.ts` seeds a couple of suppliers,
  categories, and products — one `unit`, one `weight` — for manual testing and e2e fixtures.
- **`pnpm generate`** must run after each module's contracts land and before the matching
  frontend work, so the SPA imports real types.
- **i18n**: new namespaces `members`, `admin`, `catalog` under
  `apps/web-spa/app/lib/i18n/locales/{en,fr}/`. French is the primary usage language.
- **Docs**: add a short module note in `apps/documentation` for `members` and `catalog`
  once implemented (constitution: docs live there, not in a side folder).
