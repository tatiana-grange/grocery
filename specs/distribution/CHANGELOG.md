# Changelog: Distribution — Distribution Screen, Express Order, Wallet Debit

All notable changes to this feature specification are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/)

## [2026-09-12 00:00] - /speckit.specify

### Added

- Initial feature specification created from user description: "4. Distribution — écran de
  distribution, commande express, débit du portefeuille. ~2-3 semaines" (delivery lot 4 of
  the architecture plan)
- Seven prioritised user stories: find a member and see what they collect, hand over an
  order with adjusted quantities, express order at the table, the member account ledger,
  the waiting lists, correcting a validated handover, and the new `distributor` role
- 38 functional requirements, 11 measurable success criteria, plus assumptions,
  dependencies, and an explicit out-of-scope list
- Specification quality checklist — all 16 items pass
- **Author**: AI (Claude)
- **Files**: spec.md, checklists/requirements.md

## [2026-09-12 00:00] - /speckit.specify (clarifications)

### Changed

- Resolved the two open money questions, both answered by the maintainer:
  - Staff can credit a member's account at the table, recording cash, cheque, or bank
    transfer (FR-026)
  - A handover or express order costing more than the member's balance is refused; the
    balance never goes negative, and staff record a payment and validate again (FR-027,
    FR-028)
- Added acceptance scenarios for the refused handover and the pay-then-retry path to User
  Stories 2, 3, and 4, an edge case for a member who cannot pay the difference, two
  assumptions, and success criteria SC-010 and SC-011
- **Author**: Human + AI (Claude)
- **Files**: spec.md, checklists/requirements.md

## [2026-09-12 00:00] - /speckit.plan

### Added

- Technical implementation plan created: two new modules (`distribution` holding the
  write-once `Handover`/`HandoverLine`, `wallet` holding the append-only `WalletEntry`
  ledger), plus extensions to `auth`/`members` (the `distributor` role), `orders` (one new
  status value), and `inventory` (outbound stock movements)
- Research document covering the module split, the `distributor` role seam lot 1 left open, the
  signed single-table ledger, keeping the balance non-negative under concurrency with a
  member row lock, why issuing stock at the current weighted average leaves that average
  unchanged, the `quantityOnHand` contract change negative stock forces, write-once handover
  rows, express orders reusing the order path, forward-only reversal, "ready to hand over"
  and available quantity, not charging twice, recording money received, the separate
  `/distribution` surface, E2E scope, and the unit tests the constitution requires outright
- Data model with 3 new entities (`WalletEntry`, `Handover`, `HandoverLine`), one new column
  on `StockMovement`, two widened contract enums, and the one-transaction rules for a
  handover and a reversal
- API contracts: `distribution-api.md` (screen reads, handover, express order, reversal,
  waiting lists) and `wallet-api.md` (balance, history, recording money received)
- Quickstart walking all seven user stories, with the seed data, the test commands, and what
  to check in the generated migration
- One recorded deviation (no `updatedAt` on the three write-once entities) and one recorded
  gap: the spec has no way to correct a mistyped payment
- **Author**: AI (Claude)
- **Files**: plan.md, research.md, data-model.md, quickstart.md, contracts/distribution-api.md,
  contracts/wallet-api.md

## [2026-09-12 00:00] - role rename

### Changed

- Renamed the distribution-staffing role from `grocer` to `distributor` across the spec, the
  plan, and every Phase 0/1 artifact, at the maintainer's request. The design is unchanged:
  one role a normal member can be given that opens the distribution screen and nothing else,
  with admins reaching distribution implicitly because the guard accepts either role.
- Amended the constitution to 1.3.0 (Principle V role list) and updated the three project
  documentation pages that named the old role.
- Three code comments still say `grocer` (`auth.config.ts`, `auth.decorator.ts`,
  `members/contracts/member.contract.ts`); they are corrected when lot 4 adds the role,
  because the third feeds the OpenAPI description and editing it requires regenerating the
  client.
- **Author**: Human + AI (Claude)
- **Files**: spec.md, plan.md, research.md, data-model.md, quickstart.md,
  contracts/distribution-api.md, contracts/wallet-api.md, checklists/requirements.md,
  .specify/memory/constitution.md, apps/documentation/src/content/docs/project/*.mdx

## [2026-09-12 00:00] - /speckit.tasks

### Added

- Task list generated with 85 tasks across 10 phases: Setup (4), Foundational (24), one
  phase per user story (US1 9, US2 8, US3 7, US4 9, US5 5, US6 6, US7 5), Polish (8)
- User stories covered: US1 find a member and see what they collect, US2 hand over and
  charge, US3 express order, US4 balance / history / recording money received, US5 waiting
  lists, US6 reversal, US7 the `distributor` role boundary
- Each story carries a required Playwright E2E task written first and expected to fail, and
  the Polish phase runs the full suite; six new specs in total
- The `WalletEntry` ledger, the balance primitive, the outbound stock helpers, the role and
  the migration sit in Foundational because four stories share them
- **Author**: AI (Claude)
- **Files**: tasks.md

## [2026-09-12 00:00] - /speckit.implement

### Changed

- Completed Phase 1: Setup (module and feature skeletons)
- Tasks completed: T001, T002, T003, T004
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/distribution/distribution.module.ts,
  apps/api/src/modules/wallet/wallet.module.ts, plus the `entities/` / `contracts/` /
  `tests/` subfolders of both modules and the `components/` / `utils/` folders of the two
  new frontend feature areas

## [2026-09-12 00:00] - /speckit.implement

### Changed

- Completed Phase 2 (part 1): the `distributor` role, the three new entities, the contracts,
  the shared wallet and inventory primitives, module wiring, and the migration
- Tasks completed: T005–T023
- Notable: `InventoryService.recordIssue` values an outbound movement at the product's
  current weighted average, which leaves that average unchanged — the property is now
  pinned by five unit tests in `inventory.service.spec.ts`. `getStockLevels` takes an
  optional `EntityManager` so a handover reads under its own transaction.
- **Author**: AI (Claude)
- **Files**: auth.config.ts, auth.decorator.ts, member.contract.ts, members.util.ts,
  web-spa roles.ts + use-session.ts, wallet-entry/handover/handover-line entities,
  stock-movement.entity.ts, stock.contract.ts, order.contract.ts, wallet.contract.ts,
  handover.contract.ts, distribution-screen.contract.ts, wallet.service.ts,
  inventory.service.ts, inventory.service.spec.ts, both modules, app.module.ts,
  Migration20260912142034.ts

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
