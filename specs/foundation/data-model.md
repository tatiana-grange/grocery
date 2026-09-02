# Phase 1 Data Model: Foundation

All entities: UUID primary key (`@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })`),
`createdAt` and `updatedAt` audit fields, decorators from `@mikro-orm/decorators/legacy`.
Money is stored as integer cents with an implicit `EUR` currency. Enums live in the
contract files and are exposed through `.meta()`, never on the entity.

Modules: **auth** (existing, extended), **members** (new), **catalog** (new).

---

## auth module (extended)

### User (existing — add fields)

| Field | Type | Notes |
| --- | --- | --- |
| id, name, email, emailVerified, image, createdAt, updatedAt | — | unchanged; `email` now nullable (a phone-only account has no email) |
| `role` | string | Better Auth admin plugin. Comma-separated roles. Default `member`. Values used in lot 1: `member`, `admin`. `grocer` reserved for lot 4. |
| `banned` | boolean | default `false` — admin plugin |
| `banReason` | string \| null | admin plugin |
| `banExpires` | Date \| null | admin plugin |
| `phoneNumber` | string \| null, unique | Better Auth phoneNumber plugin — alternative sign-in identifier |
| `phoneNumberVerified` | boolean | default `false` — phoneNumber plugin |

An account has at least one confirmed identifier: a verified `email` **or** a verified
`phoneNumber`.

### Session (existing — add field)

| Field | Type | Notes |
| --- | --- | --- |
| `impersonatedBy` | string \| null | admin plugin, for audit of admin-acting-as-member |

**Rule**: `role` is the only authority on back-office access. `admin` is a superset of
`member` — an admin account also has a `Member` row and every member capability. `admin`
cannot be removed from the last remaining admin (FR-018) — enforced in
`MembersService.setRoles`.

---

## members module

### Member

One row per cooperative member, 1:1 with `User`.

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `user` | ManyToOne → User, unique, not null | the identity; `@Unique()` makes it 1:1. Every account (admins included) has one. |
| `membershipNumber` | string, unique | generated at creation, e.g. `MEM-000123`; the QR payload |
| `status` | enum (contract): `pending` \| `active` \| `rejected` \| `terminated` | current status; mirror of the latest `MemberStatusChange` |
| `addressLine1` | string \| null | |
| `addressLine2` | string \| null | |
| `postalCode` | string \| null | |
| `city` | string \| null | |
| `phone` | string \| null | contact/display copy. Sign-in phone lives on `User.phoneNumber`; this may differ (e.g. a landline). |
| `joinedAt` | Date \| null | set when first moved to `active` |
| `version` | integer | `@Property({ version: true })` — optimistic lock (FR-034) |
| `createdAt` / `updatedAt` | Date | audit |

Relationships: `statusChanges` OneToMany → MemberStatusChange; `fee` OneToOne →
MembershipFee.

**State machine** (`status`):

```
            sign-up + email confirmed
                     │
                     ▼
                 pending ─── admin rejects ──▶ rejected
                     │
             admin validates
                     │
                     ▼
                  active ◀───────────────┐
                  │  │                   │
      self/admin  │  │  admin reactivates│
      terminates  │  └───────────────────┘
                  ▼
             terminated
```

- `pending → active`: sets `joinedAt` if null, sends "validated" email, creates
  `MembershipFee` if not already present.
- `pending → rejected`: sends "rejected" email with reason. Terminal unless an admin
  re-opens (treated as a fresh sign-up path).
- `active → terminated`: revoke Better Auth sessions, send "terminated" email (admin path
  carries a reason; self path does not).
- `terminated → active`: admin only; personal data retained (FR spec US5 scenario 3).
- Every transition writes one `MemberStatusChange` row in the same transaction.

### MemberStatusChange (append-only)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `member` | ManyToOne → Member, not null | |
| `fromStatus` | enum \| null | null for the initial `pending` |
| `toStatus` | enum | |
| `reason` | string \| null | required for `rejected` and admin `terminated` |
| `changedByUser` | ManyToOne → User \| null | null when the system/self did it; set for admin actions |
| `createdAt` | Date | when |

Never updated or deleted.

### MembershipFee

One row per member, created on `pending → active` (or at member creation — see research 8).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `member` | OneToOne → Member, unique, not null | |
| `expectedAmountCents` | integer ≥ 0 | seeded from `MEMBERSHIP_FEE_DEFAULT_CENTS`; editable per member (variable fee, FR-019) |
| `version` | integer | optimistic lock |
| `createdAt` / `updatedAt` | Date | audit |

Relationship: `payments` OneToMany → MembershipPayment.

**Derived** (not stored): `paidAmountCents` = Σ payments; `state` =
`unpaid` (paid = 0) \| `partly_paid` (0 < paid < expected) \| `paid` (paid ≥ expected).

### MembershipPayment (append-only)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `fee` | ManyToOne → MembershipFee, not null | |
| `kind` | enum (contract): `payment` \| `adjustment` | correction = `adjustment`, may be negative |
| `amountCents` | integer, non-zero | `payment` > 0; `adjustment` any non-zero |
| `method` | enum: `cash` \| `transfer` \| `other` | `online` reserved for lot 5 |
| `paidAt` | Date | |
| `note` | string \| null | |
| `recordedByUser` | ManyToOne → User, not null | the admin who entered it |
| `createdAt` | Date | |

Never updated or deleted; a mistake is fixed with a new `adjustment` row.

---

## catalog module

### Supplier

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `name` | string, min 1, indexed | |
| `type` | enum (contract): `producer` \| `wholesaler` | FR-022 |
| `contactName` | string \| null | |
| `contactEmail` | string \| null, email | |
| `contactPhone` | string \| null | |
| `notes` | string \| null | |
| `archivedAt` | Date \| null | soft archive (FR-023) |
| `version` | integer | optimistic lock |
| `createdAt` / `updatedAt` | Date | audit |

Relationship: `products` OneToMany → Product.

### Category

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `name` | string, min 1, unique among non-archived | |
| `parent` | ManyToOne → Category \| null | one level of nesting allowed; optional in lot 1 |
| `archivedAt` | Date \| null | "removal" = archive; blocked while non-archived products reference it (FR-026) |
| `version` | integer | optimistic lock |
| `createdAt` / `updatedAt` | Date | audit |

Relationship: `products` OneToMany → Product.

### Product

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `name` | string, min 1, indexed | |
| `description` | string \| null | |
| `supplier` | ManyToOne → Supplier, not null | |
| `category` | ManyToOne → Category, not null | |
| `saleMode` | enum (contract): `unit` \| `weight` | FR-028 |
| `pricingUnit` | enum (contract): `piece` \| `kg` | must agree with `saleMode` (`unit`→`piece`, `weight`→`kg`) |
| `photos` | `string[]` (json) | at least 0; URLs/keys of uploaded images |
| `labels` | `string[]` (json) of enum: `organic` \| `local` \| `vegetarian` \| `vegan` | FR-027 |
| `barcode` | string \| null, unique when set | used for search later; captured now if known |
| `averageWeightGrams` | integer \| null | reserved for lot 3 pre-order estimates (research 5) |
| `weightTolerancePercent` | integer \| null | reserved for lot 3 |
| `archivedAt` | Date \| null | soft archive (FR-031) |
| `version` | integer | optimistic lock |
| `createdAt` / `updatedAt` | Date | audit |

Relationship: `prices` OneToMany → ProductPrice.

**Validation rules**:
- `saleMode`/`pricingUnit` pairing enforced in the contract (refine) and the service.
- A product must have an open price row (`validTo IS NULL`) to appear as "sellable"; the
  create endpoint takes an initial price so this holds from creation.
- Archived supplier ⇒ its products are archived too (cascade, FR-032/FR-024).

### ProductPrice (append-only, windowed)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `product` | ManyToOne → Product, not null | |
| `amountCents` | integer > 0 | per `piece` or per `kg` depending on the product's `saleMode` |
| `currency` | string, fixed `EUR` | |
| `validFrom` | Date, not null | |
| `validTo` | Date \| null | null = current price; exactly one open row per product |
| `setByUser` | ManyToOne → User, not null | who changed the price |
| `createdAt` | Date | |

Never updated except to set `validTo` when superseded — that single write is the only
mutation allowed, and it happens in the same transaction as the new row's insert (research
4). Index on `(product, validTo)` for the current-price lookup.

---

## Entity relationship summary

```
User 1───1 Member 1───* MemberStatusChange
             │
             1
             │
      MembershipFee 1───* MembershipPayment
             (fee state derived from payments)

Supplier 1───* Product *───1 Category
                  │
                  1
                  │
              ProductPrice   (append-only, validFrom/validTo windows)
```

## Enums (defined in contract files, exposed via `.meta()`)

| Enum | Values | Module |
| --- | --- | --- |
| `MemberStatus` | pending, active, rejected, terminated | members |
| `MembershipFeeState` | unpaid, partly_paid, paid | members (derived) |
| `MembershipPaymentKind` | payment, adjustment | members |
| `MembershipPaymentMethod` | cash, transfer, other | members |
| `UserRole` | member, admin (`grocer` reserved for lot 4) | auth |
| `SupplierType` | producer, wholesaler | catalog |
| `ProductSaleMode` | unit, weight | catalog |
| `ProductPricingUnit` | piece, kg | catalog |
| `ProductLabel` | organic, local, vegetarian, vegan | catalog |
