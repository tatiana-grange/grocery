# Changelog: Foundation — Members, Access Roles, and Catalogue

All notable changes to this feature specification are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/)

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
