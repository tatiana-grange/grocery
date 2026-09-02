# Implementation Plan: Foundation — Members, Access Roles, and Catalogue

**Branch**: `feat/foundation` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/foundation/spec.md`

## Summary

Lot 1 delivers the base every later lot builds on: people can join the cooperative (with an
email address or a phone number), the system knows who is a plain member and who is an
admin (a member with back-office powers), and an admin can build the supplier and product
catalogue.

Technical approach: two new NestJS modules (`members`, `catalog`) following the
`example/posts` reference pattern, plus two Better Auth plugins wired into the existing
`auth` module: **admin** (roles `member` / `admin`) and **phoneNumber** (a phone-number
identifier with one-time-code verification). Auth keeps owning the `user` table; a new
`member` table holds cooperative-specific
data (profile, status history, membership fee) with a one-to-one link to `user`. Product
prices and membership payments are append-only history tables, in the spirit of the
immutable-ledger principle. The frontend gets a member area and a back-office area in
`apps/web-spa`, both reading the generated OpenAPI client.

A "grocer" role for distribution staffing and supplier login accounts are **not** in lot 1;
they arrive with lot 4. The `role` column and guard are built so adding `grocer` later is a
one-line change.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.13.0, pnpm 10.28.2 workspace
**Primary Dependencies**: NestJS, MikroORM (PostgreSQL), Zod, `@lonestone/nzoth/server`
(typed routes + OpenAPI), Better Auth with the `admin` and `phoneNumber` plugins from
`better-auth/plugins`, Nodemailer (`EmailService`), plus an SMS sender for phone OTP
(provider TBD — abstracted behind a small `SmsService`, logs to console in dev); frontend:
React 19, React Router, TanStack Query/Table/Form, react-hook-form + Zod, Tailwind + shadcn
via `@grocery/ui`, `@grocery/i18n`, Lucide icons, a QR component
**Storage**: PostgreSQL via MikroORM; schema evolved with `pnpm --filter=api db:fresh:seed`
while it is fluid, then MikroORM migrations once it stabilises
**Testing**: Vitest — controller e2e specs under each module's `tests/` (built from
`posts.controller.e2e-spec.ts`), unit specs for services, mappers, and fee/price logic
**Target Platform**: Linux server (API container) + static SPA bundle behind nginx
**Project Type**: web — monorepo `apps/api` (NestJS) + `apps/web-spa` (React SPA) +
`packages/openapi-generator` (generated client)
**Performance Goals**: standard back-office app; catalogue list endpoints paginated and
returning in under 1 second for a few thousand products; no real-time constraints in lot 1
**Constraints**: full end-to-end type safety (entity → Zod contract with `.meta()` → typed
route → `pnpm generate` → SPA import); no `any`; append-only price and payment history;
multi-row writes inside a request transaction (MikroORM default); all user-facing strings
through `@grocery/i18n`
**Scale/Scope**: one cooperative, order of 100–300 members, a few dozen suppliers, a few
thousand products; ~2 backend modules, ~7 entities, ~30 endpoints, ~12 SPA screens

No open NEEDS CLARIFICATION items — the stack is fully fixed by the constitution and the
boilerplate. Design decisions that needed a call are recorded in [research.md](./research.md).

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | How this feature complies |
| --- | --- |
| **I. Full-Stack Type Safety** | Every endpoint defined by a Zod contract with `.meta({ title, description, examples })`, exposed through `@TypedRoute.*` / typed decorators, consumed on the SPA via the regenerated `@grocery/openapi-generator` client. Enums (supplier type, sale mode, member status, fee state, role) live in contract files and are exposed through `.meta()`. Inferred types exported next to each schema. No `any`. One export per React component file. |
| **II. Immutable Money and Stock Ledgers** | Lot 1 has no `WalletEntry` / `StockMovement`. The same discipline is applied to the two history tables it does introduce: `ProductPrice` and `MembershipPayment` rows are append-only — a price change writes a new row and closes the previous one's validity window; a fee correction writes a reversing/adjusting payment row. `MemberStatusChange` is append-only too. Any operation that writes more than one row (sign-up creating `user` + `member` + first status row; price change closing one row and opening another) runs in the request transaction. No `em.fork()` outside tests. |
| **III. Module Boundaries and the Reference Pattern** | New modules are `members` and `catalog`, both in the constitution's planned set. Each has the fixed shape (`*.module.ts`, `*.controller.ts`, `*.service.ts`, entity/contract/mapper, `tests/*.e2e-spec.ts`), copied from `apps/api/src/modules/example/posts/`. `catalog` splits `entities/` and `contracts/` into subfolders because it has several. Role and phone-identifier handling is an extension of the existing `auth` module via documented Better Auth addons, not a new module. Frontend: `features/members/`, `features/catalog/`, shared bits in `features/common/`; query options in `features/<name>/utils/<name>-queries.ts`. |
| **IV. Independently Testable Increments** | User stories P1–P5 map to slices that ship on their own (see spec). Each module gets at least one controller e2e test. Fee state, price-history windowing, and by-weight pricing get unit tests before the lot is considered done. AAA for unit tests, Given-When-Then for acceptance. |
| **V. Single-Cooperative Scope Discipline** | Lot 1 implements two of the constitution's three planned roles — `member` and `admin` — via the Better Auth **admin** plugin; `grocer` is deferred to lot 4 (distribution), which is where it is first needed. This is a smaller scope than the constitution allows, not a departure from it. The **organizations** plugin is not added. Suppliers are catalogue data with no login. No multi-site, directory, or cross-cooperative concepts enter the model. |

**Technology constraints**: UUID PKs with `defaultRaw: 'gen_random_uuid()'`, `createdAt` /
`updatedAt` on every entity, decorators from `@mikro-orm/decorators/legacy`,
`em.persist()` + `em.flush()` (no `persistAndFlush`), `wrap(entity).assign(...)` for
updates. By-weight pricing, weighted average cost price, deposit products, and supplier
credit notes are designed for now (fields and enums leave room) but only by-weight pricing
is implemented in lot 1.

**Result**: PASS. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/foundation/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions and rationale
├── data-model.md        # Phase 1 — entities, fields, relationships, state machines
├── quickstart.md        # Phase 1 — how to run and verify the feature locally
├── contracts/           # Phase 1 — endpoint list and request/response schemas
│   ├── auth-roles-api.md
│   ├── members-api.md
│   └── catalog-api.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit.specify)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/api/src/modules/
├── auth/                              # existing module — extended for roles + phone
│   ├── auth.config.ts                 # add admin() plugin (defaultRole 'member', adminRoles ['admin']) + phoneNumber() plugin
│   ├── auth.module.ts                 # wire OTP delivery to SmsService (mirrors the email wiring)
│   ├── sms.service.ts                 # new — thin SMS sender, console in dev, provider in prod
│   ├── auth.entity.ts / entities/user.entity.ts   # add role, banned, banReason, banExpires, phoneNumber, phoneNumberVerified
│   ├── entities/session.entity.ts     # add impersonatedBy
│   ├── auth.guard.ts                  # member-status + @AdminOnly() checks
│   ├── auth.decorator.ts              # @AdminOnly() (@Roles(...) kept generic for the future grocer role)
│   └── auth.seeder.ts                 # seed a default admin (user + member row + role admin)
├── members/
│   ├── members.module.ts
│   ├── members.controller.ts          # member self-service + admin member management
│   ├── members.service.ts
│   ├── members.mapper.ts
│   ├── entities/
│   │   ├── member.entity.ts
│   │   ├── member-status-change.entity.ts
│   │   ├── membership-fee.entity.ts
│   │   └── membership-payment.entity.ts
│   ├── contracts/
│   │   ├── member.contract.ts
│   │   ├── membership-fee.contract.ts
│   │   └── membership-intake.contract.ts
│   ├── members.seeder.ts
│   └── tests/members.controller.e2e-spec.ts
└── catalog/
    ├── catalog.module.ts
    ├── catalog.controller.ts           # suppliers, categories, products, prices (admin)
    ├── catalog.service.ts
    ├── catalog.mapper.ts
    ├── entities/
    │   ├── supplier.entity.ts
    │   ├── category.entity.ts
    │   ├── product.entity.ts
    │   └── product-price.entity.ts
    ├── contracts/
    │   ├── supplier.contract.ts
    │   ├── category.contract.ts
    │   ├── product.contract.ts
    │   └── product-price.contract.ts
    ├── catalog.seeder.ts
    └── tests/catalog.controller.e2e-spec.ts

apps/api/src/app.module.ts             # register MembersModule, CatalogModule
apps/api/src/seeders/database.seeder.ts # wire the new seeders

packages/openapi-generator/            # `pnpm generate` refreshes the client after contracts land

apps/web-spa/app/
├── routes.ts                          # add member-area and back-office routes
├── features/
│   ├── members/                       # member self-service (account, fee, QR)
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/members-queries.ts
│   ├── admin-members/                 # back-office: pending queue, member list, roles, termination
│   │   ├── components/
│   │   └── utils/admin-members-queries.ts
│   ├── catalog/                       # back-office: suppliers, categories, products, prices
│   │   ├── components/
│   │   └── utils/catalog-queries.ts
│   └── common/                        # shared guards, role hooks, layout pieces
└── lib/i18n/locales/{en,fr}/          # new namespaces for members and catalog
```

**Structure Decision**: Web monorepo. Backend work is two new modules under
`apps/api/src/modules/` plus an in-place extension of `auth`. Frontend work is three new
feature folders under `apps/web-spa/app/features/` plus route and i18n additions. The
generated client in `packages/openapi-generator/` is the only contract between them.

## Phase 0 — Outline & Research

Unknowns to resolve (all design choices, no missing stack facts):

1. How to represent the `member` and `admin` roles with the Better Auth admin plugin, so
   `admin` is a strict superset of `member` and the future `grocer` role slots in cleanly.
2. How a person signs up and signs in with either an email address or a phone number
   (Better Auth `phoneNumber` plugin, OTP delivery, one-account-per-identifier).
3. Where cooperative member data lives: extend the auth `user` table, or a separate
   `member` table linked one-to-one. **Reviewer decision: a separate table.**
4. How "pending / active / rejected / terminated" gates sign-in, given Better Auth issues
   sessions on valid credentials.
5. How to model product price history so the current price is a lookup, not a stored
   mutable field, and old prices stay intact.
6. How by-weight pricing is represented so pre-order / reception / billing quantities can
   diverge later (lot 3+) without a schema change.
7. Archiving strategy (soft archive) and how archived rows are excluded from active lists
   but kept in detail/history views.
8. Optimistic-concurrency approach for the "someone edited this since you loaded it"
   requirement.
9. Membership-fee model: default amount config, per-member override, partial payments,
   derived fee state.
10. Email/SMS confirmation and admin-decision notifications through `EmailService` /
    `SmsService` and Better Auth hooks.
11. Personal QR code: what it encodes and where it is generated (client vs server).

**Output**: [research.md](./research.md) — one decision + rationale + alternatives per item.

## Phase 1 — Design & Contracts

**Prerequisites**: research.md complete.

1. **Data model** → [data-model.md](./data-model.md): the entities above with fields,
   types, relationships, validation rules pulled from the functional requirements, and the
   two state machines (member status, product price windows).

2. **API contracts** → [contracts/](./contracts/): endpoint tables grouped by area
   (auth-roles, members, catalog) with method, path, guard, request schema, response
   schema, and error cases. Schemas expressed as Zod contract outlines with `.meta()`,
   ready to become `*.contract.ts` files. REST, following the `posts` controller
   conventions (`admin/*` prefix and `AuthGuard`, `public/*` only where truly public — in
   lot 1 the only near-public surface is sign-up, which Better Auth already owns).

3. **Quickstart** → [quickstart.md](./quickstart.md): env setup, run the DB and MailDev,
   seed a default admin, `pnpm generate`, and a manual walk-through of the five user
   stories.

4. **Agent context**: run
   `.specify/scripts/bash/update-agent-context.sh claude` after this plan is filled so
   `CLAUDE.md` picks up the two new modules. (Left for the implementer to run alongside
   `/speckit.tasks`.)

**Re-check Constitution after design**: the Phase 1 artifacts keep every gate green —
contracts carry `.meta()`, history tables stay append-only, modules keep the reference
shape. No new violations. PASS.

## Phase 2 — Planning approach (for `/speckit.tasks`, not done here)

Task generation should produce, in dependency order:

1. Auth: admin plugin (`member`/`admin`) + phoneNumber plugin, `SmsService`, entity fields
   (role, ban*, phoneNumber, phoneNumberVerified, session.impersonatedBy), migration/fresh,
   guard + `@AdminOnly()`, default admin seeder, auth e2e updates.
2. `members` module backend: entities → contracts → mapper → service → controller → module
   registration → seeder → e2e. Then `pnpm generate`.
3. `catalog` module backend: same sequence. Then `pnpm generate`.
4. Frontend `members` (self-service), `admin-members` (back office), `catalog` (back
   office): queries, components, routes, i18n, guards.
5. Cross-cutting: optimistic-concurrency handling, email templates, QR code, quickstart
   verification, docs update in `apps/documentation`.

Group by user story so each priority can be delivered and demoed on its own: P1 sign-up and
validation, P2 catalogue, P3 self-service and roles, P4 roles admin, P5 termination.

## Complexity Tracking

No constitution violations. Table intentionally empty.
