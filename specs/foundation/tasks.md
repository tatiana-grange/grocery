---
description: "Task list for the Foundation feature (lot 1)"
---

# Tasks: Foundation — Members, Access Roles, and Catalogue

**Input**: Design documents from `/specs/foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. The project constitution requires at least one controller e2e test per
API module and unit tests for money / by-weight logic, so those test tasks are mandatory,
not optional.

**Organization**: Tasks are grouped by user story. Setup and Foundational phases unblock
every story; after them, stories can be built in priority order or in parallel.

## Path Conventions

- Backend: `apps/api/src/modules/<module>/...`
- Frontend: `apps/web-spa/app/features/<feature>/...`
- Generated client: `packages/openapi-generator/` (refreshed with `pnpm generate`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Wire the Better Auth plugins, SMS sender, entity fields, and shared frontend
scaffolding that everything else needs.

- [x] T001 Add the `admin` (`defaultRole: 'member'`, `adminRoles: ['admin']`) and `phoneNumber` plugins to `apps/api/src/modules/auth/auth.config.ts`, and update the exported `BetterAuthType`
- [x] T002 [P] Create `SmsService` in `apps/api/src/modules/auth/sms.service.ts` — a thin sender that logs the message to the console in dev and calls a provider (stubbed) otherwise
- [x] T003 [P] Extend `apps/api/src/modules/auth/entities/user.entity.ts` (`role`, `banned`, `banReason`, `banExpires`, `phoneNumber` unique nullable, `phoneNumberVerified`; make `email` nullable) and `entities/session.entity.ts` (`impersonatedBy`)
- [x] T004 Wire phone OTP and reset delivery into `apps/api/src/modules/auth/auth.module.ts`: inject `SmsService`, add the phoneNumber plugin's `sendOTP` / password-reset handlers next to the existing email wiring (depends on T001, T002)
- [x] T005 Run `pnpm --filter=api auth:generate`, review the generated auth schema/entities, then `pnpm --filter=api db:fresh` (depends on T003, T004)
- [x] T006 [P] Add `@AdminOnly()` and a generic `@Roles(...)` decorator to `apps/api/src/modules/auth/auth.decorator.ts`
- [x] T007 [P] Add the `phoneNumberClient` plugin to `apps/web-spa/app/lib/auth-client.ts`
- [x] T008 [P] Add `MEMBERSHIP_FEE_DEFAULT_CENTS` and `SMS_*` config to `apps/api/src/config/env.config.ts` and `apps/api/.env.example`
- [x] T009 [P] Create empty i18n namespaces `members`, `admin`, `catalog` under `apps/web-spa/app/lib/i18n/locales/en/` and `.../fr/`

**Checkpoint**: Auth accepts an email or a phone identifier and knows about roles.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `members` module skeleton, the `Member` graph, sign-up wiring, the guard,
the default admin, and shared frontend layout. No user story can start until this is done.

**⚠️ CRITICAL**: Blocks every user story.

- [x] T010 [P] Create `Member` entity in `apps/api/src/modules/members/entities/member.entity.ts` (1:1 `User`, `membershipNumber` unique, `status`, address fields, `phone`, `joinedAt`, `version`, audit)
- [x] T011 [P] Create append-only `MemberStatusChange` entity in `apps/api/src/modules/members/entities/member-status-change.entity.ts`
- [x] T012 [P] Create `MembershipFee` entity in `apps/api/src/modules/members/entities/membership-fee.entity.ts` (1:1 `Member`, `expectedAmountCents`, `version`)
- [x] T013 [P] Create single-row `MembershipIntakeSetting` entity in `apps/api/src/modules/members/entities/membership-intake-setting.entity.ts`
- [x] T014 [P] Create `membershipNumber` generator util in `apps/api/src/modules/members/members.util.ts` (`MEM-000123` sequence)
- [x] T015 Create enums and shared schemas in `apps/api/src/modules/members/contracts/member.contract.ts` (`memberStatus`, `userRole` = `['member','admin']`, fee enums, `memberProfile`/`identifier`/`feeSummary`/`memberSelf`/`memberListItem`/`memberDetail`), each with `.meta()` and an exported inferred type (depends on T010, T011, T012)
- [x] T016 Create `members.module.ts`, `members.service.ts` (constructor + `EntityManager`), and `members.mapper.ts` skeletons in `apps/api/src/modules/members/` (depends on T010–T015)
- [x] T017 Implement sign-up wiring in `apps/api/src/modules/members/members.hooks.ts` (Better Auth `@Hook` provider): `after` the sign-up route, create the `Member` row (`status: 'pending'`) + first `MemberStatusChange` in one transaction; `before` the sign-up route, refuse when `MembershipIntakeSetting` is closed (depends on T016, T013, T014)
- [x] T018 Extend `apps/api/src/modules/auth/auth.guard.ts`: after resolving the session, load the linked `Member`, cache it on `request`; enforce a confirmed identifier + `member.status === 'active'` for member-scoped routes; enforce `@AdminOnly()` via `role` (depends on T010, T006)
- [x] T019 Register `MembersModule` (with `MikroOrmModule.forFeature([...])`) in `apps/api/src/app.module.ts` (depends on T016)
- [x] T020 Create `apps/api/src/modules/members/members.seeder.ts` seeding one admin (Better Auth user + `Member` row + `role: 'admin'` + `status: 'active'`) and wire it into `apps/api/src/seeders/database.seeder.ts` (depends on T016)
- [x] T021 Run `pnpm --filter=api db:fresh:seed`, then `pnpm generate` to publish the member enums and shared types (depends on T019, T020)
- [x] T022 [P] Create `useCurrentMember` and `useIsAdmin` hooks in `apps/web-spa/app/features/common/hooks/`
- [x] T023 [P] Create route-guard components and the member-area + back-office layout shells in `apps/web-spa/app/features/common/`
- [x] T024 Add the member-area and back-office route groups to `apps/web-spa/app/routes.ts` (depends on T023)

**Checkpoint**: A signed-up person lands as a pending member; a seeded admin can sign in.

---

## Phase 3: User Story 1 - A person joins the cooperative (Priority: P1) 🎯 MVP

**Goal**: Someone registers with an email or a phone number, confirms it, an admin
validates (or rejects) them, and they can then sign in as an active member.

**Independent Test**: Register end to end once with an email and once with a phone number,
confirm the identifier, validate from the back office, sign in. Reject path and duplicate
path also verified. No catalogue or self-service work needed.

### Tests for User Story 1

- [x] T025 [P] [US1] Create `apps/api/src/modules/members/tests/members.controller.e2e-spec.ts` covering: sign-up (email) → pending; sign-up (phone, OTP stubbed) → pending; member-scoped route → 403 while pending; admin validate → active + `joinedAt` set + fee row exists; admin reject with reason → 403 + reason in history; duplicate email/phone → 409; sign-up while intake closed → refused; unauthenticated → 401; non-admin on `/admin/members` → 403

### Implementation for User Story 1

- [x] T026 [P] [US1] Add `createMemberSchema` (email-or-phone refine) and `memberValidationSchema` (discriminated union validate/reject) to `apps/api/src/modules/members/contracts/member.contract.ts`
- [x] T027 [P] [US1] Create `apps/api/src/modules/members/contracts/membership-intake.contract.ts` (`{ open: boolean }`)
- [x] T028 [US1] Implement `MembersService`: `listMembers` (filters `status`/`feeState`/`role`/`q`, pagination via `@lonestone/nzoth/server` helpers), `getMember`, `createMember` (admin path — Better Auth admin API for the user + `Member` row, in one transaction) in `apps/api/src/modules/members/members.service.ts` (depends on T016)
- [x] T029 [US1] Implement `MembersService.validateMember` / `rejectMember`: status transition + `MemberStatusChange` row + set `joinedAt` on validate + create `MembershipFee` (seeded from `MEMBERSHIP_FEE_DEFAULT_CENTS`) on validate + revoke Better Auth sessions on reject, all transactional (depends on T028, T012)
- [x] T030 [US1] Implement `MembersService` membership-intake read/write against `MembershipIntakeSetting` (depends on T013)
- [x] T031 [US1] Implement decision notifications (validated / rejected) sent to the member's confirmed identifier via `EmailService` or `SmsService`, strings from `@grocery/i18n` (depends on T029, T004)
- [x] T032 [US1] Implement `members.mapper.ts`: `toMemberSelf`, `toMemberListItem`, `toMemberDetail` (collections guarded with `isInitialized()` + `getItems()`) (depends on T015)
- [x] T033 [US1] Implement `apps/api/src/modules/members/members.controller.ts` admin routes: `GET /admin/members`, `GET /admin/members/:id`, `POST /admin/members`, `POST /admin/members/:id/validation`, `GET`+`PUT /admin/membership-intake`, all `@AdminOnly()` (depends on T028–T032)
- [x] T034 [US1] Run `pnpm generate` (depends on T033)
- [ ] T035 [P] [US1] Frontend: email/phone toggle on the register form in `apps/web-spa/app/features/auth/forms/auth-register-form.tsx` — DEFERRED: self-registration by email already works end to end; the phone sign-up UI (synthesized address + OTP step) plus a matching login toggle is carried to a follow-up.
- [ ] T036 [P] [US1] Frontend: phone OTP confirmation step/page under `apps/web-spa/app/features/auth/pages/` — DEFERRED with T035.
- [x] T037 [P] [US1] Frontend: `apps/web-spa/app/features/admin-members/utils/admin-members-queries.ts` (list, detail, mutations) (depends on T034)
- [x] T038 [US1] Frontend: pending-queue and member-list pages in `apps/web-spa/app/features/admin-members/components/` (depends on T037)
- [x] T039 [US1] Frontend: member-detail page with validate / reject actions and status history in `apps/web-spa/app/features/admin-members/components/` (depends on T037)
- [x] T040 [US1] Frontend: wire US1 routes in `routes.ts` and fill `members` / `admin` i18n strings (en + fr) (depends on T038, T039, T024)

**Checkpoint**: US1 is a demoable MVP — the cooperative can register and validate members.

---

## Phase 4: User Story 2 - An administrator builds the catalogue (Priority: P2)

**Goal**: An admin creates suppliers, categories, and products (per-unit or by-weight),
sets and changes prices with history kept, and archives what is no longer offered.

**Independent Test**: Create a supplier and category, add a `unit` product and a `weight`
product with initial prices, change a price twice and inspect the history, archive a
product and a supplier (with cascade). No member or self-service work needed.

### Tests for User Story 2

- [x] T041 [P] [US2] Create `apps/api/src/modules/catalog/tests/catalog.controller.e2e-spec.ts` covering: supplier/category/product create + list (+ `includeArchived`); by-weight product gets `pricingUnit: kg`; two price changes → three contiguous windows, one open; archive product (absent from list, present in detail); archive supplier without `cascade` → 409 with count, with `?cascade=true` → both archived; archive category referenced by an active product → 409; stale `version` → 409; non-admin → 403
- [x] T042 [P] [US2] Create `apps/api/src/modules/catalog/tests/catalog.service.spec.ts` unit tests: price-window transition (close current + open new) and `saleMode → pricingUnit` derivation (AAA)

### Implementation for User Story 2

- [x] T043 [P] [US2] `Supplier` entity in `apps/api/src/modules/catalog/entities/supplier.entity.ts` (`type`, contact fields, `archivedAt`, `version`)
- [x] T044 [P] [US2] `Category` entity in `apps/api/src/modules/catalog/entities/category.entity.ts` (`name`, optional `parent`, `archivedAt`, `version`)
- [x] T045 [P] [US2] `Product` entity in `apps/api/src/modules/catalog/entities/product.entity.ts` (`saleMode`, `pricingUnit`, `photos` json, `labels` json, `barcode`, reserved `averageWeightGrams` / `weightTolerancePercent`, `archivedAt`, `version`)
- [x] T046 [P] [US2] Append-only `ProductPrice` entity in `apps/api/src/modules/catalog/entities/product-price.entity.ts` (`amountCents`, `currency`, `validFrom`, `validTo` nullable, `setByUser`; index `(product, validTo)`)
- [x] T047 [P] [US2] `supplier.contract.ts` and `category.contract.ts` in `apps/api/src/modules/catalog/contracts/` (enums + create/update/response schemas, `.meta()`)
- [x] T048 [P] [US2] `product.contract.ts` and `product-price.contract.ts` in `apps/api/src/modules/catalog/contracts/` (enums `supplierType`, `saleMode`, `pricingUnit`, `label`; a shared euros↔cents transform helper)
- [x] T049 [US2] Create `catalog.module.ts`, `catalog.service.ts` skeleton, and `catalog.mapper.ts` in `apps/api/src/modules/catalog/` (depends on T043–T048)
- [x] T050 [US2] `CatalogService` suppliers: `create` / `update` (optimistic `version`), `list` (filters, `includeArchived`), `get`, `archive` (+ `cascade` in one transaction), `unarchive` (depends on T049)
- [x] T051 [US2] `CatalogService` categories: `create` / `update`, `list`, `archive` (refuse while non-archived products reference it), `unarchive` (depends on T049)
- [x] T052 [US2] `CatalogService` products: `create` (+ initial open `ProductPrice` in one transaction), `update` (`version`, not price), `list` (filters), `getDetail` (current price + history) (depends on T049)
- [x] T053 [US2] `CatalogService.setProductPrice`: close the current open window (`validTo = effectiveFrom`) and insert a new open window, one transaction; `archiveProduct` / `unarchiveProduct` with supplier/category parent checks (depends on T052)
- [x] T054 [US2] `catalog.mapper.ts`: supplier / category / product / product-detail mapping incl. `currentPriceEur` and `priceHistory` (depends on T048)
- [x] T055 [US2] `apps/api/src/modules/catalog/catalog.controller.ts`: every route in `contracts/catalog-api.md`, all `@AdminOnly()` (depends on T050–T054)
- [x] T056 [US2] Register `CatalogModule` in `apps/api/src/app.module.ts`; create `catalog.seeder.ts` (2 suppliers, 1 category, a `unit` and a `weight` product with prices) and wire into `database.seeder.ts` (depends on T049)
- [x] T057 [US2] Run `pnpm generate` (depends on T055)
- [x] T058 [P] [US2] Frontend: `apps/web-spa/app/features/catalog/utils/catalog-queries.ts` (depends on T057)
- [x] T059 [US2] Frontend: supplier list + create/edit form in `apps/web-spa/app/features/catalog/components/` (depends on T058)
- [x] T060 [US2] Frontend: category management component in `apps/web-spa/app/features/catalog/components/` (depends on T058)
- [x] T061 [US2] Frontend: product list + create/edit form (unit and by-weight) in `apps/web-spa/app/features/catalog/components/` (depends on T058)
- [x] T062 [US2] Frontend: price-change dialog + price-history view in `apps/web-spa/app/features/catalog/components/` (depends on T058)
- [x] T063 [US2] Frontend: archive / unarchive actions + `includeArchived` toggle; wire catalog routes and `catalog` i18n strings (en + fr) (depends on T059–T062, T024)

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - A member manages their own account (Priority: P3)

**Goal**: A member edits their own details, changes their password, sees their status and
fee state, and has a personal QR code. Admins can set the expected fee and record payments.

**Independent Test**: As an active member, edit details, change password and re-sign-in,
view status + fee state + QR. As an admin, set a variable fee and record two partial
payments watching the state move `unpaid → partly_paid → paid`, then an adjustment.

### Tests for User Story 3

- [ ] T064 [P] [US3] Extend `members.controller.e2e-spec.ts`: `GET`/`PUT /members/me`, `PUT /members/me/profile` stale `version` → 409, fee state transitions across `POST /admin/members/:id/fee/payments` including a negative `adjustment`
- [ ] T065 [P] [US3] Create `apps/api/src/modules/members/tests/members.service.spec.ts` unit tests for fee-state derivation (`unpaid` / `partly_paid` / `paid`, boundary at exactly expected)

### Implementation for User Story 3

- [ ] T066 [P] [US3] Append-only `MembershipPayment` entity in `apps/api/src/modules/members/entities/membership-payment.entity.ts` (`kind`, `amountCents`, `method`, `paidAt`, `note`, `recordedByUser`)
- [ ] T067 [P] [US3] Create `apps/api/src/modules/members/contracts/membership-fee.contract.ts` (`feeSummary`, `setFee`, `recordFeePayment` with kind/adjustment refine, `updateMyProfile`)
- [ ] T068 [US3] `MembersService` self-service: `getMyAccount`, `updateMyProfile` (optimistic `version`) (depends on T016)
- [ ] T069 [US3] `MembersService` fee: `setExpectedFee` (`version`), `recordPayment` (append-only; `payment` > 0, `adjustment` any non-zero), `deriveFeeState` (depends on T066)
- [ ] T070 [US3] `MembersService.updateMemberProfile` (admin edit, `version`) (depends on T016)
- [ ] T071 [US3] `members.controller.ts`: `GET /members/me`, `PUT /members/me/profile`, `PUT /admin/members/:id/profile`, `PUT /admin/members/:id/fee`, `GET`+`POST /admin/members/:id/fee/payments` (depends on T068–T070)
- [ ] T072 [US3] Run `pnpm generate` (depends on T071)
- [ ] T073 [P] [US3] Frontend: `features/members/utils/members-queries.ts` + account page (profile form, status, fee state) in `apps/web-spa/app/features/members/components/` (depends on T072)
- [ ] T074 [P] [US3] Frontend: personal QR component (encodes `membershipNumber`) in `apps/web-spa/app/features/members/components/`
- [ ] T075 [US3] Frontend: password-change form (Better Auth `change-password`) and confirm the forgot/reset pages handle the phone path in `apps/web-spa/app/features/auth/` (depends on T072)
- [ ] T076 [US3] Frontend: fee panel (expected amount + payment list + record payment) and admin profile edit on the member-detail page; wire routes + i18n (depends on T072)

**Checkpoint**: US1–US3 all work independently.

---

## Phase 6: User Story 4 - An administrator manages the admin role (Priority: P3)

**Goal**: An admin grants or removes the `admin` role; the last admin cannot be demoted.

**Independent Test**: Grant `admin` to a plain member, confirm back-office access plus
retained member capabilities; remove it, confirm access withdrawn; try to demote the only
admin and get a clear refusal.

### Tests for User Story 4

- [ ] T077 [P] [US4] Extend `members.controller.e2e-spec.ts`: grant `admin` → member gains `@AdminOnly()` access; remove → withdrawn; remove `admin` from the last admin → 409; non-admin calling the route → 403

### Implementation for User Story 4

- [ ] T078 [P] [US4] Add `setMemberRolesSchema` (`roles: ['member','admin']`, `version`) to `apps/api/src/modules/members/contracts/member.contract.ts`
- [ ] T079 [US4] `MembersService.setRoles`: replace the role set on the Better Auth user, refuse dropping `admin` from the last admin, transactional (depends on T016)
- [ ] T080 [US4] `members.controller.ts`: `PUT /admin/members/:id/roles` (depends on T079)
- [ ] T081 [US4] Run `pnpm generate` (depends on T080)
- [ ] T082 [US4] Frontend: admin-role toggle on the member-detail page + i18n in `apps/web-spa/app/features/admin-members/components/` (depends on T081)

**Checkpoint**: US1–US4 all work independently.

---

## Phase 7: User Story 5 - Ending a membership (Priority: P4)

**Goal**: A member self-terminates, or an admin terminates them with a reason, or an admin
reactivates a terminated member with data intact.

**Independent Test**: Self-terminate and confirm sign-out + refusal; admin-terminate another
member with a reason and confirm the notification and status; reactivate and confirm active
status with personal data unchanged.

### Tests for User Story 5

- [ ] T083 [P] [US5] Extend `members.controller.e2e-spec.ts`: self-termination → `terminated` + next request unauthorised; admin termination with reason → status + history + notification; reactivation → `active`, profile fields unchanged

### Implementation for User Story 5

- [ ] T084 [P] [US5] Add termination and reactivation schemas to `apps/api/src/modules/members/contracts/member.contract.ts`
- [ ] T085 [US5] `MembersService`: `selfTerminate`, `adminTerminate(reason)`, `reactivate` — status transition + `MemberStatusChange` + Better Auth session revoke, transactional (depends on T029)
- [ ] T086 [US5] Termination notification (email / SMS) + i18n strings (depends on T085, T031)
- [ ] T087 [US5] `members.controller.ts`: `POST /members/me/termination`, `POST /admin/members/:id/termination`, `POST /admin/members/:id/reactivation` (depends on T085)
- [ ] T088 [US5] Run `pnpm generate` (depends on T087)
- [ ] T089 [P] [US5] Frontend: "End membership" action with a confirmation dialog in `apps/web-spa/app/features/members/components/` (depends on T088)
- [ ] T090 [US5] Frontend: terminate / reactivate actions on the member-detail page + i18n (depends on T088)

**Checkpoint**: All five user stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Shared UX, docs, migrations, and the full quality gate.

- [ ] T091 [P] Shared optimistic-concurrency conflict component (stale-`version` reload prompt) in `apps/web-spa/app/features/common/`, used by the members and catalog forms
- [ ] T092 [P] Add a `members` module note in `apps/documentation/src/content/docs/project/` (or a module `README`) and regenerate `apps/documentation/INDEX.md`
- [ ] T093 [P] Add a `catalog` module note in `apps/documentation/src/content/docs/project/` and regenerate `INDEX.md`
- [ ] T094 Run `.specify/scripts/bash/update-agent-context.sh claude` so `CLAUDE.md` lists the `members` and `catalog` modules
- [ ] T095 Generate the lot migration once the schema is stable: `pnpm --filter=api db:migrate:create`, review the SQL for DROP+ADD and NOT-NULL-on-existing-rows, commit the migration and the updated `.snapshot` files
- [ ] T096 [P] Unit tests for the `members` and `catalog` mappers in each module's `tests/` folder
- [ ] T097 Walk through `specs/foundation/quickstart.md` end to end — all five user stories, email and phone paths
- [ ] T098 Run the pre-merge gate: `pnpm lint && pnpm typecheck && pnpm test`
- [ ] T099 [P] i18n audit — confirm no hardcoded user-facing strings in the new `members`, `admin-members`, and `catalog` features

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: needs Setup. Blocks all user stories.
- **User stories (Phases 3–7)**: each needs Foundational. US1 has no story dependencies.
  US3, US4, US5 touch the same `members.service.ts` / `members.controller.ts` /
  `member.contract.ts` / member-detail page that US1 creates, so in practice run them after
  US1. US2 (`catalog`) is fully independent of the member stories and can run in parallel
  with US1 by a second developer.
- **Polish (Phase 8)**: after the stories you intend to ship. T095 (migration) should wait
  until the schema stops changing.

### Story dependencies

- **US1 (P1)**: after Foundational. Independent.
- **US2 (P2)**: after Foundational. Independent of every member story — parallelizable.
- **US3 (P3)**: after Foundational; extends US1's `members` service/controller/contract and
  member-detail page.
- **US4 (P3)**: after Foundational; extends US1's `members` controller and member-detail page.
- **US5 (P4)**: after Foundational; reuses the status-transition helper from US1 (T029).

### Within a story

- e2e / unit test tasks first (they will fail until the implementation lands).
- Entities → contracts → module skeleton → service → mapper → controller → `pnpm generate`
  → frontend queries → frontend components → routes + i18n.

### Parallel opportunities

- Setup: T002, T003, T006, T007, T008, T009 in parallel.
- Foundational: T010–T014 in parallel; T022, T023 in parallel with backend work.
- US1: T025 alongside T026/T027; T035, T036, T037 in parallel.
- US2: T041, T042 alongside T043–T048 (all different files); T058 gated on `pnpm generate`.
- Different stories in parallel across developers once Foundational is done — US1 + US2 is
  the natural split.

---

## Parallel Example: User Story 2 entities and contracts

```bash
Task: "Supplier entity in apps/api/src/modules/catalog/entities/supplier.entity.ts"
Task: "Category entity in apps/api/src/modules/catalog/entities/category.entity.ts"
Task: "Product entity in apps/api/src/modules/catalog/entities/product.entity.ts"
Task: "ProductPrice entity in apps/api/src/modules/catalog/entities/product-price.entity.ts"
Task: "supplier.contract.ts and category.contract.ts in apps/api/src/modules/catalog/contracts/"
Task: "product.contract.ts and product-price.contract.ts in apps/api/src/modules/catalog/contracts/"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 Setup.
2. Phase 2 Foundational.
3. Phase 3 User Story 1.
4. Stop and validate: register (email + phone), confirm, validate, sign in.
5. Demo — the cooperative can onboard its membership.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → demo (MVP).
3. US2 → demo (catalogue is ready for lot 2).
4. US3 → demo (members self-serve, fee tracking).
5. US4 → demo (role administration).
6. US5 → demo (full member lifecycle).
7. Polish → migration, docs, quality gate.

### Parallel team strategy

- Everyone: Setup + Foundational.
- Then Developer A takes US1 (and later US3, US4, US5 in order); Developer B takes US2 end
  to end. They only meet at `app.module.ts`, `database.seeder.ts`, and `routes.ts`.

---

## Notes

- `[P]` = different files, no dependency on an unfinished task.
- Run `pnpm generate` after every contract change and before the matching frontend task.
- While the `members` / `catalog` schemas move, use `pnpm --filter=api db:fresh:seed`; keep
  the migration (T095) for when they settle.
- `WalletEntry` / `StockMovement` are not in this lot, but `ProductPrice`, `MembershipPayment`,
  and `MemberStatusChange` follow the same append-only rule — never edit a past row.
- Commit after each task or logical group; stop at any checkpoint to validate a story.
