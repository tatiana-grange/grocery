<!--
Sync Impact Report
==================
Version change: (template) → 1.0.0
Ratification date: 2026-09-01
Rationale: Initial constitution. Values derived from README.md, CLAUDE.md, CONTRIBUTING.md,
apps/documentation guidelines (general, backend, frontend) and the project planning notes
(apps/documentation/src/content/docs/project/).

Principles defined:
  I.   Full-Stack Type Safety (NON-NEGOTIABLE)
  II.  Immutable Money and Stock Ledgers (NON-NEGOTIABLE)
  III. Module Boundaries and the Reference Pattern
  IV.  Independently Testable Increments
  V.   Single-Cooperative Scope Discipline

Added sections:
  - Technology Constraints
  - Development Workflow and Quality Gates
  - Governance

Templates status:
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate is generic; no edit required
  ✅ .specify/templates/spec-template.md — no constitution references; no edit required
  ✅ .specify/templates/tasks-template.md — no constitution references; no edit required
  ✅ .specify/templates/checklist-template.md — no constitution references; no edit required

Follow-up TODOs: none.
-->

# Participative Grocery App Constitution

Governance rules for the management app of a participative grocery cooperative run at a
single location, inspired by [MonÉpi](https://www.monepi.fr). This document is the
governance layer. `CLAUDE.md` and `apps/documentation/` hold the day-to-day workflow and
coding guidelines.

## Core Principles

### I. Full-Stack Type Safety (NON-NEGOTIABLE)

Every data flow from database to browser MUST stay typed end to end. The chain is:
MikroORM entity → Zod contract schema with `.meta({ title, description, examples })` →
`@TypedRoute.*` / typed decorators from `@lonestone/nzoth/server` → auto-generated OpenAPI
spec → generated SDK and types in `@grocery/openapi-generator` (via `pnpm generate`) →
frontend imports from that package.

Rules:

- Never use `any`. Create a proper type or interface instead.
- Prefer interfaces over type aliases, except for types inferred from Zod schemas.
- Export the inferred type next to every schema: `export type X = z.infer<typeof xSchema>`.
- Every request and response schema MUST carry `.meta()` so the OpenAPI docs stay useful.
- Enums live in contract files and are exposed through `.meta()`, not in entities.
- One export per file for React components.

Rationale: the generated client is the only contract between the API and the two front
office surfaces. If the chain breaks, the frontend ships against a spec that no longer
matches the server.

### II. Immutable Money and Stock Ledgers (NON-NEGOTIABLE)

Member balance and stock level are always the sum of movement rows, never a stored field
that gets overwritten.

- `WalletEntry` and `StockMovement` rows are append-only. You never edit or delete a past
  row.
- Corrections are made by writing a reversing entry, not by mutating history.
- Every operation that writes more than one row (top-up, refund, credit note, distribution
  debit, reception, adjustment) runs inside a real database transaction. MikroORM wraps
  each controller request in a transaction by default; code paths outside a request
  (CRON, scripts) MUST establish their own context with `@EnsureRequestContext()`.
- Never call `em.fork()` unless you fully understand the MikroORM context implications.

Rationale: this app holds real member money and real cooperative stock. A lost or edited
movement is an accounting error that cannot be reconstructed.

### III. Module Boundaries and the Reference Pattern

Backend features are NestJS modules with a fixed shape: `feature.module.ts`,
`feature.controller.ts`, `feature.service.ts`, `feature.entity.ts`, `feature.contract.ts`,
`feature.mapper.ts`, and `tests/feature.controller.e2e-spec.ts`. Split `entities/` and
`contracts/` into subfolders only when there is more than one.

- There is no generator. Copy `apps/api/src/modules/example/posts/` and adapt it.
- Controllers map entities to contracts through a mapper. Services return entities.
- Mappers handle collections through `getItems()` after checking `isInitialized()`.
- The planned module set for a single location is: `members`, `catalog`, `orders`,
  `purchasing`, `inventory`, `distribution`, `wallet`, `planning`, `payments`,
  `accounting`. A feature that does not fit one of these needs a constitution amendment or
  an explicit decision recorded in the feature's `plan.md`.
- Frontend code is organised by feature under `features/<name>/` with `components/`,
  `hooks/`, `utils/`; shared code goes in `features/common/`. TanStack Query options live
  in `features/<name>/utils/<name>-queries.ts`.

Rationale: one predictable shape keeps a solo or small team fast and keeps generated
clients and tests in familiar places.

### IV. Independently Testable Increments

Work is delivered in vertical slices that each stand on their own.

- User stories are prioritised P1, P2, P3 by cooperative value. Each priority level MUST
  deliver something usable on its own.
- The MVP follows the delivery lots in the architecture plan (foundation → shop and orders
  → purchasing → distribution → wallet → planning → accounting). Lots 1–4 form one
  complete cycle: order, buy, receive, distribute, pay.
- Every API module has at least one controller e2e test (`vitest`), built from the
  `example/posts` e2e test.
- Unit tests cover public service functions and use test doubles for dependencies, except
  cheap third-party code. Tests follow Arrange-Act-Assert; acceptance tests follow
  Given-When-Then.
- Money, stock, and sale-by-weight logic MUST have tests before the feature is considered
  done.

Rationale: slices that ship independently let the cooperative start using real features
while the rest is still being built, and they keep integration risk small.

### V. Single-Cooperative Scope Discipline

This app serves one cooperative at one location. That assumption is load-bearing and keeps
the build small.

- Out of scope: multi-site hosting, the cooperative directory, group orders between
  cooperatives, the announcements module, the services module, the BAR module.
- Roles are `member`, `grocer`, `admin`, handled by the Better Auth admin plugin. The
  Better Auth organizations plugin is not used.
- Adding any out-of-scope capability is a separate, explicitly approved piece of work and
  requires a constitution amendment.

Rationale: MonÉpi is multi-tenant by design; we are not. Every multi-site accommodation we
avoid is complexity the cooperative never pays for.

## Technology Constraints

Mandatory stack:

- Backend: NestJS, TypeScript, MikroORM, PostgreSQL, Zod, Swagger/OpenAPI, Better Auth,
  `@lonestone/nzoth/server`.
- Frontend: React single-page app (`apps/web-spa`, no SSR) serving both the public shop and
  the back office; React Router; TanStack Query; react-hook-form + Zod; Tailwind CSS +
  shadcn/ui via `@grocery/ui`; `@grocery/i18n` for all user-facing strings (no hardcoded
  text); Lucide icons only.
- Tooling: `pnpm` for dependencies and scripts; oxlint and oxfmt; Docker for local
  PostgreSQL and MailDev.

Data rules:

- UUID primary keys with `defaultRaw: 'gen_random_uuid()'`.
- `createdAt` and `updatedAt` audit fields on every entity.
- Early development may use `pnpm --filter=api db:fresh:seed`; once a schema stabilises,
  switch to the migration workflow. Review generated SQL before applying it (MikroORM can
  emit DROP+ADD instead of RENAME). Never run a fresh/reset against production.

Domain constraints to design for from the start: products sold by weight (priced per kg,
delivered at an approximate weight, so pre-order, reception, and billing quantities
differ), weighted average cost price on stock, deposit products (consigne), supplier
credit notes, and a distribution screen that must be fast and tolerant of a flaky network.

## Development Workflow and Quality Gates

- Feature work uses the Spec-Driven flow: `/speckit.specify` → `/speckit.plan` →
  `/speckit.tasks` → `/speckit.implement`, with specs under `specs/<feature-name>/`.
- Project documentation lives in `apps/documentation/`, never in a side `docs/` folder.
- Commits and pull requests follow `CONTRIBUTING.md`: Conventional Commits, valid
  type/scope from `commitlint.config.ts`, squash merge where the PR title and description
  become the commit. Never write `BREAKING-CHANGE:` unless a major release is intended.
  Do not co-author commits with Claude.
- Pre-merge gates: `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass; the feature's
  task list is complete; affected documentation is updated.
- Pre-production gates for anything touching money, stock, or user data: migrations tested
  with realistic data, and a review that checks the two non-negotiable principles above.

Code review MUST verify: type safety through the full stack, `.meta()` on schemas, ledger
immutability where relevant, transaction use for multi-row writes, no `any`, naming
conventions, and tests where the feature requires them.

## Governance

- This constitution supersedes contradicting practices. `CLAUDE.md` and the documentation
  guidelines cover workflow; where they conflict with a principle here, the principle wins.
- Amendments: open a pull request that states the rationale, updates this file with a new
  version number and the Sync Impact Report, and updates any affected `.specify/templates/`
  file. Breaking amendments describe the migration path for existing features.
- Versioning (semantic):
  - MAJOR: a principle is removed or redefined in a backward-incompatible way, or
    governance changes incompatibly.
  - MINOR: a new principle or section is added, or guidance is materially expanded.
  - PATCH: clarifications and wording fixes with no change in meaning.
- Compliance: every pull request is reviewed against these principles. A justified
  violation is recorded in the feature's `plan.md` Complexity Tracking table, with the
  simpler alternative that was rejected and why.

**Version**: 1.0.0 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-01
