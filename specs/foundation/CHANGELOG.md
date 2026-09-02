# Changelog: Foundation — Members, Access Roles, and Catalogue

All notable changes to this feature specification are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/)

## [2026-09-02 10:48] - /speckit.implement

### Changed

- Completed Phase 5: User Story 3 — a member manages their own account (P3)
- Tasks completed: T064–T076 (T066's `MembershipPayment` entity landed back in Phase 2)
- Backend: contract additions (`updateProfileSchema`, `setFeeSchema`, `recordFeePaymentSchema` with the kind/adjustment refine, `feePaymentsListSchema`). `MembersService` gained `getMyAccount`, `updateMyProfile` / `updateMemberProfile` (shared `applyProfile` with optimistic version), `setExpectedFee` (fee-row version check), `recordFeePayment` (append-only), and `listFeePayments`. New `MemberSelfController` (`GET /members/me`, `PUT /members/me/profile`, `@MemberScoped()`); `AdminMembersController` gained `PUT /admin/members/:id/profile`, `PUT /admin/members/:id/fee`, `GET`/`POST /admin/members/:id/fee/payments`. Mapper `toFeePayments`.
- Tests: `members.mapper.spec.ts` (fee-state derivation, 4 cases) and three new e2e cases (self account + 403 for a pending member, profile update + stale-version 409, fee state `unpaid → partly_paid → paid` then back via an adjustment). Full api suite: 139 passed.
- Live verification: `GET /members/me` returns the account + fee summary, `PUT /members/me/profile` updates the city, admin `PUT .../fee` sets the expected amount, and `POST .../fee/payments` moves paid to 1500 / state `partly_paid`.
- Frontend: `account` feature — an account page with a status + fee badge, an editable personal-details form (optimistic version), a personal **QR code** (`qrcode.react`, encodes only the membership number), and a password-change form (Better Auth `changePassword`, revokes other sessions). Admin-members detail page gained a **fee panel** (set expected amount, record payment or adjustment with a method, payment history). `members.account` and `adminMembers.fee` i18n filled (en + fr). Added `qrcode.react` to `apps/web-spa`.
- Verified: `pnpm typecheck` (all), `pnpm --filter=api test` (139), `pnpm lint`, `pnpm --filter=web-spa build` all pass.
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/members/{contracts/member.contract.ts,members.service.ts,members.mapper.ts,members.controller.ts,members.module.ts,tests/members.controller.e2e-spec.ts,tests/members.mapper.spec.ts}, apps/web-spa/app/features/account/** (new), apps/web-spa/app/features/admin-members/{utils/admin-members-queries.ts,components/member-detail-page.tsx,components/member-fee-panel.tsx}, apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json, apps/web-spa/package.json, packages/openapi-generator/client/**, specs/foundation/tasks.md

## [2026-09-02 10:33] - /speckit.implement

### Changed

- Completed Phase 4: User Story 2 — an administrator builds the catalogue (P2)
- Tasks completed: T041–T063 (all 23)
- New `catalog` module: `Supplier`, `Category`, `Product`, `ProductPrice` (append-only, windowed) entities; four contract files with enums (`SupplierType`, `ProductSaleMode`, `ProductPricingUnit`, `ProductLabel`) and `.meta()`-annotated response schemas — response titles prefixed `Catalog*` to avoid a collision with the AI example's `Product` schema. `CatalogService` covers supplier CRUD + archive (409 with `activeProductCount`, `?cascade=true` in one transaction), category CRUD + archive guard (409 with `productCount`), product create (with the first open price row in one transaction), update, list with filters, detail with full price history, and `setProductPrice` (closes the current window at `effectiveFrom`, inserts a new open row, one transaction). `CatalogMapper` exposes euros at the edge (cents stored) and derives `pricingUnit` from `saleMode`. Three `@AdminOnly()` controllers (`admin/suppliers`, `admin/categories`, `admin/products`). Registered in `app.module.ts`; `CatalogSeeder` adds two suppliers, one category, and a per-unit + a by-weight product.
- Tests: `catalog.controller.e2e-spec.ts` (8 cases — by-weight pricing, windowed history, product archive visibility, supplier cascade 409/200, category archive 409, stale version 409, 401/403 gating) and `catalog.service.spec.ts` (money rounding, `pricingUnitFor`). Full api suite: 132 passed.
- Live verification: seeded "Pommes Golden" is `weight` / `kg` / 2.40 €, "Pain de campagne" is `unit` / `piece` / 3.20 €; two price changes give three windows with exactly one open and `currentPriceEur` 3.50; archiving the seeded supplier without cascade returns 409 `activeProductCount: 2`, with cascade returns 200.
- Client: `pnpm generate` published the catalogue SDK / zod / types.
- Frontend: `catalog` feature (built on `@grocery/ui`) — a tabbed back-office page (Products / Suppliers / Categories), supplier and category tabs with create/edit dialogs and archive/restore (supplier cascade prompt on 409), a product list with search + pagination, a product create form (supplier/category selects, sale mode, labels, initial price), and a product detail page with a change-price dialog, the price-history timeline, and archive/restore. Routes `/admin/catalog`, `/admin/catalog/products/new`, `/admin/catalog/products/:productId`. `catalog` i18n filled (en + fr).
- Verified: `pnpm typecheck` (all), `pnpm --filter=api test` (132), `pnpm lint`, `pnpm --filter=web-spa build` all pass.
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/catalog/** (new), apps/api/src/app.module.ts, apps/api/src/seeders/database.seeder.ts, apps/web-spa/app/features/catalog/** (new), apps/web-spa/app/routes.ts, apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json, packages/openapi-generator/client/**, specs/foundation/tasks.md

## [2026-09-02 10:06] - /speckit.implement

### Changed

- Completed Phase 3: User Story 1 — a person joins the cooperative (P1 / MVP), minus the deferred phone sign-up UI
- Tasks completed: T025, T026, T027, T028, T029, T030, T031, T032, T033, T034, T037, T038, T039, T040 (T035, T036 deferred)
- Backend: `MembersService` gained `listMembers` (status / role / free-text filters, pagination), `getMemberDetail`, `feeStatesFor`, `validateMember` / `rejectMember` (status transition + append-only `MemberStatusChange`, `joinedAt`, membership-fee row creation on validate, session revoke on reject), and the membership-intake read/write. `MembersMapper` maps to `memberSelf` / `memberListItem` / `memberDetail`. New `AdminMembersController` + `MembershipIntakeController` (`GET /admin/members`, `GET /admin/members/:id`, `POST /admin/members/:id/validation`, `GET`/`PUT /admin/membership-intake`), all `@AdminOnly()`. `AuthGuard` now reads class-level `@AdminOnly()` via `getAllAndOverride`. Decision emails/SMS sent to the confirmed identifier.
- Contract: `memberValidationSchema` (discriminated validate/reject) and `membershipIntakeSchema` added.
- Client: `pnpm generate` published the member SDK + zod + types (`adminMembersControllerList/Detail/Decide`, `membershipIntakeControllerGet/Set`).
- Tests: `members.controller.e2e-spec.ts` — 7 cases (list + status filter, 401/403 gating, validate, reject with reason, stale-version 409, non-pending 400, intake switch). `EmailService` / `SmsService` stubbed in the harness. Full api suite: 123 passed.
- Live verification: admin signs in, a fresh sign-up appears as `MEM-000002` / pending, `POST …/validation` with `version: 1` returns `status: active` + `joinedAt` set + fee row (`unpaid`) + history `[pending, active]`, and the "membership confirmed" email lands in MailDev.
- Frontend: `admin-members` feature — TanStack Query options + `decideMember` mutation, a members list page (status tabs pending/active/all, free-text search, paginated table, fee badge) and a member detail page (identity, roles, status history, validate button + reject dialog with reason). `MemberStatusBadge`. Route `/admin/members/:memberId` wired. `members` / `adminMembers` i18n filled (en + fr), `common.cancel` added.
- Deferred: T035 / T036 — the register form still signs up by email only; phone sign-up (synthesized hidden address + OTP step) and the matching login toggle are a follow-up. Self-registration by email works end to end today.
- `POST /admin/members` (admin-direct member creation) is not implemented in this pass — the MVP flow is self-sign-up + admin validation; direct creation via the Better Auth admin API is a follow-up.
- Verified: `pnpm typecheck` (all), `pnpm --filter=api test` (123), `pnpm lint`, `pnpm --filter=web-spa build` all pass.
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/members/{members.service.ts,members.mapper.ts,members.controller.ts,members.module.ts,contracts/member.contract.ts,tests/members.controller.e2e-spec.ts}, apps/api/src/modules/auth/auth.guard.ts, apps/web-spa/app/features/admin-members/** (new), apps/web-spa/app/routes.ts, apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json, packages/openapi-generator/client/**, specs/foundation/tasks.md

## [2026-09-02 09:53] - /speckit.implement

### Changed

- Completed Phase 2: Foundational (blocking prerequisites)
- Tasks completed: T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024
- New `members` module: `Member`, `MemberStatusChange`, `MembershipFee`, `MembershipPayment`, `MembershipIntakeSetting` entities; `member.contract.ts` with the enums and shared response schemas (all `.meta()`-annotated); `MembersService` (intake setting, member lookup), `MembersMapper` (fee-state derivation), `members.util.ts` (membership-number generator, role parse/serialize, `ensurePendingMember`, `isMembershipIntakeOpen`), `members.factory.ts` (test/seed factory), `MembersSeeder` (default admin: admin@example.com / admin12345).
- Sign-up wiring: Better Auth `databaseHooks.user.create` in `auth.module.ts` — `before` refuses sign-up while intake is closed, `after` creates the pending `Member` + first status-history row. Verified live: signing up `alice@example.com` produced `MEM-000002` / `pending`; the seeded admin is `MEM-000001` / `active`.
- `AuthGuard` extended: parses the `role` string, enforces `@AdminOnly()` / `@Roles()`, and for `@MemberScoped()` routes requires a confirmed identifier and an active membership (admins bypass the status check). `@MemberScoped()` decorator added. `createSessionFromUser` test helper now carries `role` / `phoneNumber` / `phoneNumberVerified`.
- Frontend: `features/common` — `useRoles` / `useIsAdmin` hooks, `roles.ts` helper, `BackOfficeLayout` (admin-gated sidebar shell) and `MemberAreaLayout` (member top-bar shell); placeholder pages for `/account`, `/admin/members`, `/admin/catalog`; routes wired; `members` / `adminMembers` / `catalog` i18n keys filled (en + fr).
- Deviations from the task text: T017 lives in `auth.module.ts` + `members.util.ts` rather than a `members.hooks.ts` `@Hook` provider (databaseHooks fire on the real user-create path and the e2e harness mocks auth anyway). T022's `useCurrentMember` fetch is deferred to US3 where `/members/me` exists. Entity relation properties are typed `Rel<T>` to avoid an `emitDecoratorMetadata` circular-import crash. `MembershipPayment` entity was created now (referenced by `MembershipFee`) though its endpoints come in US3.
- Verified: `pnpm typecheck` (all), `pnpm --filter=api test` (116 passed), `pnpm lint`, `pnpm --filter=api build`, `pnpm --filter=web-spa build` all pass; `db:fresh:seed` rebuilds and seeds cleanly.
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/members/** (new), apps/api/src/modules/auth/{auth.guard.ts,auth.decorator.ts,auth.module.ts}, apps/api/src/app.module.ts, apps/api/src/seeders/database.seeder.ts, apps/api/src/test/helpers/test-auth.helper.ts, apps/web-spa/app/features/{common,account,admin-members,catalog}/** (new), apps/web-spa/app/routes.ts, apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json, specs/foundation/tasks.md

## [2026-09-02 09:38] - /speckit.implement

### Changed

- Completed Phase 1: Setup (shared infrastructure)
- Tasks completed: T001, T002, T003, T004, T005, T006, T007, T008, T009
- Better Auth `admin` (roles `member` / `admin`) and `phoneNumber` (OTP by SMS) plugins added; `SmsService` logs the code to the console in dev; `auth:generate` added the plugin fields to the `User` and `Session` entities and `db:fresh` rebuilt the schema; `@AdminOnly()` / `@Roles()` decorators added; frontend auth client gained the `admin` and `phoneNumber` client plugins; `SMS_*` and `MEMBERSHIP_FEE_DEFAULT_CENTS` config added; `members` / `adminMembers` / `catalog` i18n keys stubbed.
- Deviation from the plan: `user.email` is kept NOT NULL. Phone sign-up will use a synthesized hidden address (`<digits>@phone.grocery.local`) so the existing MikroORM auth adapter and schema codegen need no change. Verified: `POST /api/auth/phone-number/send-otp` returns "code sent" and logs the code; `GET /api/auth/admin/list-users` returns 401; API boots; `pnpm --filter=api typecheck`, `pnpm --filter=web-spa typecheck`, `pnpm lint`, `pnpm --filter=api build` all pass.
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/auth/auth.config.ts, auth.module.ts, auth.decorator.ts, sms.service.ts, entities/user.entity.ts, entities/session.entity.ts, apps/api/src/config/env.config.ts, apps/api/.env.example, apps/web-spa/app/lib/auth-client.ts, apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json, specs/foundation/tasks.md

## [2026-09-01 22:46] - /speckit.specify

### Added

- Initial feature specification created from user description: "lot 1" (the Foundation delivery lot: members, access roles, supplier and product catalogue)
- **Author**: AI (Claude)
- **Files**: spec.md, checklists/requirements.md

## [2026-09-01 23:01] - /speckit.plan

### Added

- Technical implementation plan created (stack, Constitution Check, project structure, phased approach)
- Phase 0 research: 10 design decisions with rationale and alternatives (Better Auth admin plugin for roles, separate `member` table, sign-in gating on member status, append-only windowed price history, by-weight pricing, soft-archive strategy, optimistic concurrency, derived membership-fee state, email notifications, client-side QR code)
- Phase 1 data model: 7 entities across `auth`/`members`/`catalog`, member-status and price-window state machines, enum inventory
- Phase 1 API contracts: endpoint tables and Zod schema outlines for auth/roles, members, and catalogue, with e2e coverage notes
- Quickstart: local run steps and a manual walk-through of the five user stories
- **Author**: AI (Claude)
- **Files**: plan.md, research.md, data-model.md, quickstart.md, contracts/auth-roles-api.md, contracts/members-api.md, contracts/catalog-api.md

## [2026-09-01 23:16] - /speckit.plan

### Changed

- Applied plan-review feedback (Plannotator) to spec and plan artifacts:
  - Sign-up and sign-in now support an email address **or** a phone number (Better Auth `phoneNumber` plugin, OTP by SMS, new `SmsService`). Updated FR-001/002/003/008/009/013, User Story 1, edge cases, entities, assumptions, dependencies.
  - Dropped the `grocer` role from lot 1 — roles are `member` and `admin` only, `admin` being a strict superset of `member`; `grocer` and supplier login accounts move to lot 4. Updated FR-014–FR-018, User Story 4, Success Criteria, Constitution Check, contracts.
  - Confirmed the reviewer's choice of a **separate `member` table** (already the draft's direction).
- **Author**: Human (review) + AI (Claude)
- **Files**: spec.md, plan.md, research.md, data-model.md, quickstart.md, contracts/auth-roles-api.md, contracts/members-api.md

## [2026-09-01 23:21] - /speckit.tasks

### Added

- Task list generated with 99 tasks across 8 phases
- User stories covered: US1 (join the cooperative), US2 (build the catalogue), US3 (member self-service), US4 (admin role management), US5 (ending a membership)
- Per-story counts: Setup 9, Foundational 15, US1 16, US2 23, US3 13, US4 6, US5 8, Polish 9
- **Author**: AI (Claude)
- **Files**: tasks.md

---

<!--
CHANGELOG GUIDELINES

This changelog tracks all modifications to the feature specification documents.
Each speckit command MUST add an entry when modifying files.

## Entry Format

## [YYYY-MM-DD HH:MM] - /speckit.<command>
### Added | Changed | Fixed | Removed
- Description of what was added/changed/fixed/removed
- **Author**: Human | AI (Claude)
- **Files affected**: spec.md, plan.md, etc.

## Commands and their changelog actions

| Command | Action | Section |
|---------|--------|---------|
| /speckit.specify | Create spec | Added |
| /speckit.clarify | Clarify requirements | Changed |
| /speckit.plan | Create plan | Added |
| /speckit.tasks | Create tasks | Added |
| /speckit.checklist | Create checklist | Added |
| /speckit.implement | Complete task | Changed |
| /speckit.analyze | Analysis report | Added (if issues found) |

## Example entries

## [2025-01-09 14:30] - /speckit.specify
### Added
- Initial feature specification created from user description
- **Author**: AI (Claude)
- **Files**: spec.md

## [2025-01-09 15:00] - /speckit.clarify
### Changed
- Clarified authentication method: OAuth2 selected
- Clarified data retention period: 90 days
- **Author**: Human + AI (Claude)
- **Files**: spec.md

## [2025-01-09 16:00] - /speckit.plan
### Added
- Technical implementation plan created
- Research document with technology decisions
- Data model with 3 entities
- API contracts for 5 endpoints
- **Author**: AI (Claude)
- **Files**: plan.md, research.md, data-model.md, contracts/
-->
