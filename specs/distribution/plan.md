# Implementation Plan: Distribution — Distribution Screen, Express Order, Wallet Debit

**Branch**: `feat/distribution` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/distribution/spec.md`

## Summary

Lot 4 closes the cycle lots 1–3 opened: goods leave the shelf and money leaves the member's
account, together or not at all. Two new modules, both on the constitution's pre-approved
list and split the way the architecture plan already describes: **distribution**
(`Handover` / `HandoverLine` — a write-once record of what was actually given, kept separate
from the order so an adjusted quantity never edits lot 2's checkout snapshot) and **wallet**
(`WalletEntry` — the append-only ledger a member's balance is summed from). The existing
`inventory` module gains outbound movements, `orders` gains one status value, and
`auth` / `members` gain the `distributor` role that lot 1 deliberately left a seam for.

Three decisions carry the design. Issuing stock at the product's **current weighted average
cost** leaves that average mathematically unchanged, so lot 3's `buildStockLevel` serves both
directions untouched (research.md §5). A **pessimistic lock on the member row** is what makes
"the balance never goes negative" hold when two tills validate at once — the same pattern lot
3 already uses on the supplier order (research.md §4). And a reversal **points forward only**,
from the reversing row to the original, so correcting a mistake never writes to a row the
ledger rules declare immutable (research.md §9).

The frontend adds one new surface: a `/distribution` route group behind its own
distributor-or-admin layout, deliberately not folded into the admin back office, whose gate is a
single `isAdmin` check that `rbac-admin.spec.ts` asserts (research.md §13).

**One open item before `/speckit.tasks`**: the spec gives staff no way to correct a mistyped
payment, so a wrong amount would sit in the ledger permanently. Closing it is small — a fourth
`reason` value and one endpoint, mirroring the handover reversal — but it is a requirement the
spec does not carry, so it is not designed into the contracts. See research.md §12.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.13.0, pnpm 10.28.2 workspace.
**Primary Dependencies**: NestJS, MikroORM (PostgreSQL), Zod, `@lonestone/nzoth/server`,
Better Auth `admin` plugin (backend, all existing); React, react-router, TanStack Query,
react-hook-form + Zod, Tailwind CSS + shadcn/ui via `@grocery/ui`, `@grocery/i18n`, Lucide
icons (frontend, all existing). No new dependency.
**Storage**: PostgreSQL via MikroORM. New tables: `walletEntry`, `handover`, `handoverLine`.
One new nullable column on the existing `stockMovement` table (`handoverLineId`). No DDL for
the new `order.status`, `stockMovement.reason`, or role values — all three are varchar columns
whose allowed values live in contract enums.
**Testing**: vitest for API unit and controller e2e specs; Playwright for the web-spa e2e
suite (`apps/web-spa-e2e`).
**E2E suite present?**: **Yes** — `apps/web-spa-e2e` (Playwright, `pnpm e2e`). This feature
MUST ship its own Playwright specs (distribution screen, handover with adjusted quantities,
insufficient-balance refusal and pay-then-retry, express order, reversal, waiting lists,
`distributor` role boundary) and is only considered done when the full `pnpm e2e` suite passes. A
failing E2E test blocks the feature; a human decides whether to fix the test or the behaviour,
per the project's E2E guide. The suite also needs a new `distributor` role fixture
(research.md §14).
**Target Platform**: Web — NestJS API (Linux server) + React SPA (browser), same as lots 1–3.
**Project Type**: Web application (existing `apps/api` + `apps/web-spa` monorepo split).
**Performance Goals**: The distribution screen is the one surface with a real target, because
there is a queue behind it: SC-005 asks for a five-line handover in under 60 seconds and
SC-006 for a three-product express sale in under 90 — both human-speed budgets, which means
the screen must not make staff wait on round trips. One call returns the whole member screen
(member, status, balance, every outstanding order with lines and stock), and recording a
payment returns the updated balance so the refused handover can be retried without a refetch.
**Constraints**: Money as signed integer cents (`amountCents`, `currency: 'EUR'`), same as
`ProductPrice` / `OrderLine` / `ReceptionLine`. Quantities `decimal(10,3)` (grams). Validating
a handover — lock, balance check, handover rows, stock movements, wallet entry, order status —
runs in one transaction (Principle II). `WalletEntry`, `Handover`, and `HandoverLine` are
write-once. Stock is allowed to go negative (spec Assumptions), which means the existing
`stockSummarySchema.quantityOnHand` must stop being `nonnegative()` (research.md §6). **No
offline mode** — the spec rules it out, so the "tolerant of a flaky network" line in the
constitution's domain constraints is met by failing atomically and never half-charging, not by
queueing.
**Scale/Scope**: Single cooperative, single location. A distribution serves tens of members in
an afternoon; the ledger and the movement table grow by a handful of rows per handover.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
| --- | --- | --- |
| I. Full-Stack Type Safety | New entities → Zod contracts with `.meta()` → typed routes → `pnpm generate` → SDK. `walletEntryReason`, `paymentMethod`, `handoverKind`, and `notReadyReasonCode` are contract-level enums, not entity-level; `stockMovementReason` and `orderStatus` gain values in the contract files that already own them. The one existing contract this lot changes (`stockSummarySchema.quantityOnHand`) is changed deliberately and the client regenerated, rather than left to fail response validation at runtime (research.md §6). | ✅ Pass |
| II. Immutable Money and Stock Ledgers | `WalletEntry` is the money ledger this lot introduces: append-only, balance always `SUM(amountCents)`, never a stored field (research.md §3). `Handover` / `HandoverLine` are write-once on the lot 3 `Reception` precedent, and a reversal points forward only so no existing row is ever touched (research.md §9). Every multi-row write — handover, express order, reversal — runs in one `em.transactional`, with a pessimistic lock on the member row so the non-negative rule holds under concurrency (research.md §4). | ✅ Pass |
| III. Module Boundaries and the Reference Pattern | `distribution` and `wallet` are both on the pre-approved module list, split along the responsibilities the architecture plan already assigns them (research.md §1). Fixed module file shape followed; `wallet.controller.ts` holds two controller classes in one file, per the existing `catalog.controller.ts` precedent. `distribution` depends on `wallet` and `inventory` through services that take the caller's `EntityManager`, exactly as `purchasing` depends on `inventory` today. Frontend organised as `features/distribution/` and `features/wallet/` with `components/` / `hooks/` / `utils/`, queries in `utils/<name>-queries.ts`. | ✅ Pass |
| IV. Independently Testable Increments | 7 prioritised user stories (P1 ×4, P2 ×3), each independently testable per the spec, each with its own e2e coverage (API + Playwright). The money, stock, and by-weight logic Principle IV names outright gets dedicated unit tests, listed concretely in research.md §15 — including the weighted-average-unchanged property from §5 held as a test. | ✅ Pass |
| V. Single-Cooperative Scope Discipline | No multi-site, directory, or group-order concept. `distributor` is added as the third of the exactly three roles Principle V names, through the Better Auth `admin` plugin's existing role string — the organizations plugin stays unused. `distributor` is deliberately kept out of `ADMIN_USER_ROLES` so it gains no Better Auth admin powers (research.md §2). | ✅ Pass |

**Post-design re-check (after Phase 1)**: still passing, with one clarification worth
recording. The design reads the `orders` and `inventory` modules' entities from
`distribution` (an `OrderLine`'s snapshot price, a product's stock level) and writes
`Order.status` and `StockMovement` rows through their owning services. That is the same
cross-module shape lot 3 already established between `purchasing` and `inventory`, so it needs
no new deviation. Unlike lot 3, this lot adds **no** column to another module's entity —
order settlement is derived by query instead (data-model.md, "Order settlement"), which is one
fewer cross-module write than lot 3 needed.

One recorded deviation (see Complexity Tracking), from guidance that is not NON-NEGOTIABLE:
the "`createdAt` and `updatedAt` audit fields on every entity" data rule, extending the exact
precedent lots 2 and 3 already set. Principles I, II, III, IV, and V are clean.

## Project Structure

### Documentation (this feature)

```text
specs/distribution/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── distribution-api.md   # Screen reads, handover, express order, reversal, waiting lists
│   └── wallet-api.md         # Balance, history, recording money received
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
apps/api/src/modules/
├── auth/                                 # existing, extended
│   ├── auth.config.ts                    # + 'distributor' in USER_ROLES; ADMIN_USER_ROLES unchanged
│   └── auth.decorator.ts                 # + StaffOnly() = @Roles('distributor', 'admin')
│
├── members/                              # existing, extended
│   ├── contracts/member.contract.ts      # + 'distributor' in USER_ROLES / userRoleSchema
│   └── members.util.ts                   # parseRoles / serializeRoles accept 'distributor'
│
├── orders/                               # existing, extended
│   └── contracts/order.contract.ts       # + 'handed_over' in ORDER_STATUSES
│
├── inventory/                            # existing, extended
│   ├── entities/stock-movement.entity.ts # + handoverLine (nullable FK)
│   ├── contracts/stock.contract.ts       # + 'distribution' / 'distribution_reversal' reasons;
│   │                                      #   quantityOnHand: nonnegative() → number()
│   ├── inventory.service.ts              # + recordIssue(em, …) and recordIssueReversal(em, …),
│   │                                      #   mirroring recordReceipt
│   └── tests/inventory.service.spec.ts   # + weighted-average-unchanged, negative stock level
│
├── wallet/                               # NEW module
│   ├── wallet.module.ts
│   ├── wallet.controller.ts              # StaffWalletController (@StaffOnly, 'wallet') +
│   │                                      #   MemberWalletController (@MemberScoped, 'me/wallet'),
│   │                                      #   two classes in one file per catalog.controller.ts
│   ├── wallet.service.ts                 # getBalanceCents(em, memberId), charge(em, …),
│   │                                      #   credit(em, …), recordPayment, listEntries
│   ├── wallet.mapper.ts
│   ├── entities/wallet-entry.entity.ts
│   ├── contracts/wallet.contract.ts
│   └── tests/
│       ├── wallet.controller.e2e-spec.ts
│       └── wallet.service.spec.ts        # unit: balance derivation, zero-movement member
│
├── distribution/                         # NEW module
│   ├── distribution.module.ts
│   ├── distribution.controller.ts        # @StaffOnly() — member search + screen, handover,
│   │                                      #   express order, reversal, waiting lists, products
│   ├── distribution.service.ts           # getMemberScreen, recordHandover, createExpressOrder,
│   │                                      #   reverseHandover, listWaiting
│   ├── distribution.mapper.ts
│   ├── distribution.util.ts              # pure: line totals, settlement check, readiness
│   ├── entities/
│   │   ├── handover.entity.ts
│   │   └── handover-line.entity.ts
│   ├── contracts/
│   │   ├── handover.contract.ts
│   │   └── distribution-screen.contract.ts
│   └── tests/
│       ├── distribution.controller.e2e-spec.ts
│       ├── distribution.service.spec.ts  # unit: adjusted totals at snapshot prices, the
│       │                                  #   insufficient-balance boundary, not-ready refusal,
│       │                                  #   settlement, reversal restoring stock and balance
│       └── distribution.mapper.spec.ts
│
└── db/migrations/
    └── Migration<timestamp>_distribution.ts   # walletEntry / handover / handoverLine tables +
                                                #   stockMovement.handoverLineId

apps/api/src/seeders/
└── e2e.fixtures.ts                       # + a distributor account, + E2E_DISTRIBUTION fixtures

apps/web-spa/app/
├── features/
│   ├── distribution/                     # NEW
│   │   ├── components/
│   │   │   ├── distribution-home-page.tsx        # member search + the two waiting lists
│   │   │   ├── distribution-member-page.tsx      # the table screen
│   │   │   ├── handover-form.tsx                 # per-line quantity / weight, running total
│   │   │   ├── express-order-form.tsx            # product search by name or barcode
│   │   │   ├── insufficient-balance-dialog.tsx   # shortfall + record a payment + retry
│   │   │   └── handover-receipt-page.tsx         # on-screen receipt, reversal action
│   │   └── utils/distribution-queries.ts
│   ├── wallet/                           # NEW
│   │   ├── components/
│   │   │   ├── wallet-panel.tsx          # balance + history, used by the account page
│   │   │   └── record-payment-form.tsx   # staff, cash / cheque / transfer
│   │   └── utils/wallet-queries.ts
│   ├── account/                          # existing — account page mounts <WalletPanel />
│   └── common/
│       ├── components/
│       │   ├── distribution-layout.tsx   # NEW — gated on distributor-or-admin
│       │   └── back-office-layout.tsx    # existing — + a link across to /distribution
│       ├── hooks/use-session.ts          # + isGrocer / isStaff
│       └── lib/roles.ts                  # UserRole gains 'distributor'; parseRoles accepts it
├── routes.ts                             # + the /distribution group under the new layout
└── lib/i18n/locales/{en,fr}/             # + distribution / wallet namespaces

apps/web-spa-e2e/
├── env.ts                                # Role union + 'distributor'
├── fixtures.ts                           # withRole('distributor')
├── auth.setup.ts                         # seed the distributor session
└── tests/
    ├── distribution-screen.spec.ts       # NEW — find, ready vs not ready, balance, empty state
    ├── distribution-handover.spec.ts     # NEW — adjust, validate, stock and balance move, no double charge
    ├── distribution-express.spec.ts      # NEW — by name and barcode, stock warning, validate
    ├── distribution-wallet.spec.ts       # NEW — refusal, record payment, retry, member's own view
    ├── distribution-reversal.spec.ts     # NEW — reverse, both entries visible, order reusable
    └── rbac-distributor.spec.ts               # NEW — distributor in, admin in, member out, distributor out of /admin/*
```

**Structure Decision**: Web application, existing monorepo split (`apps/api` +
`apps/web-spa`). No new app or package. Two new backend modules (`distribution`, `wallet`),
four existing backend modules extended, and one new frontend surface at `/distribution` with
its own layout — kept out of the admin back office so each layout enforces exactly one access
rule (research.md §13).

## Complexity Tracking

| Deviation | Why it is needed | Simpler alternative rejected |
| --- | --- | --- |
| `Handover`, `HandoverLine`, and `WalletEntry` carry `createdAt` but no `updatedAt`, against the Technology Constraints data rule "`createdAt` and `updatedAt` audit fields on every entity". | All three are written once and never edited — `WalletEntry` because Principle II forbids it outright, the two handover rows because a mistake is corrected by a reversing handover (FR-010, FR-022). An `updatedAt` would always equal `createdAt`, and if it ever moved it would signal a bug rather than record history. This extends the exact precedent lot 2 recorded for `OrderLine` and lot 3 for `Reception` / `ReceptionLine`. | Add an `updatedAt` that never changes — rejected as misleading noise on rows the code must never touch after creation, and as an invitation to write to them. |
