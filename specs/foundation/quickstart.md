# Quickstart: Foundation (lot 1)

How to run the feature locally and walk through the five user stories.

## Prerequisites

- Node 24.13.0, pnpm 10.28.2, Docker running.
- Repo bootstrapped once: `pnpm install`, then `pnpm rock` (or the manual `.env` copy from
  the root README).

## Start the stack

```bash
pnpm docker:up                       # PostgreSQL + MailDev
pnpm --filter=api db:fresh:seed      # rebuild schema from entities + seed
pnpm dev                             # API + web-spa in watch mode
```

- API: `http://localhost:<API_PORT>` — OpenAPI at `/docs`.
- SPA: `http://localhost:5173`.
- MailDev inbox: `http://localhost:1080` (confirmation and notification emails land here).
- SMS one-time codes: in development `SmsService` prints them to the API console (no
  provider needed).

Regenerate the typed client whenever a contract changes:

```bash
pnpm generate
```

## Seed data

`db:fresh:seed` creates:

- One **admin** account — `admin@example.com` / `admin12345` — with its own `member` row,
  `role = admin`, `status = active` (from the members/auth seeder).
- A couple of suppliers, one category, and two products (one `unit`, one `weight`) with
  prices, for manual testing.

After changing anything the Better Auth plugins touch (`user` / `session` fields), refresh
the generated auth schema before rebuilding:

```bash
pnpm --filter=api auth:generate
```

## Walk through the user stories

### US1 — A person joins (P1)

Email path:

1. SPA `/register`: sign up with a name, email, password.
2. Open MailDev, click the verification link → SPA `/verify-email` confirms.
3. Try to sign in → you reach the member area but `/members/me` shows **pending**; member
   actions are blocked.
4. Sign in as the admin, open **Back office → Members → Pending**, validate the request.
5. MailDev shows the "validated" email. Sign in as the new member → account is **active**.
6. Try signing up again with the same email → clear "already registered" error.

Phone path:

1. `/register`: sign up with a name, phone number, password.
2. Read the one-time code from the API console, enter it on the confirmation step.
3. Same as above from step 3 — pending, admin validates, then sign in with the phone number.
4. Try signing up again with the same phone number → clear "already registered" error.

### US2 — Build the catalogue (P2)

1. As admin: **Back office → Suppliers → New** — create a producer.
2. **Products → New** — add a per-unit product (price in €) and a by-weight product (price
   per kg). Confirm the by-weight one shows "/ kg".
3. Change a product's price. Open its detail → price history shows the old and new windows.
4. Archive a product → it leaves the active list, still opens from a direct link and from
   history.
5. Archive the supplier → prompt about its active products; choose cascade and confirm both
   are archived.

### US3 — Member self-service (P3)

1. As the member: edit personal details (address, phone) → reload, changes persisted.
2. Change password → sign out → sign in with the new one.
3. Use **forgot password** from `/login` → reset via the MailDev link.
4. Account page shows membership status and fee state, plus a personal QR code.

### US4 — Roles (P3)

1. As admin: on a plain member, grant the **admin** role.
2. Sign in as that member → the back office is reachable, and every plain-member screen
   still works.
3. Remove the role → back-office access withdrawn, still an active member.
4. Try to remove `admin` from the only admin → blocked with a clear message.

### US5 — Ending a membership (P4)

1. As the member: **Account → End membership** → confirm. You are signed out and cannot
   sign back in as active.
2. As admin: terminate another member with a reason → they get the email, status is
   **terminated**, record still visible.
3. Reactivate them → back to **active**, personal data intact.

## Tests

```bash
pnpm --filter=api test               # includes members + catalog e2e specs
pnpm lint && pnpm typecheck
```

Expected new suites: `members.controller.e2e-spec.ts`, `catalog.controller.e2e-spec.ts`,
plus unit specs for fee-state derivation and price-window transitions.

## Moving to migrations

Once the `members` and `catalog` entities stop changing, generate the lot's migration and
review the SQL before committing:

```bash
pnpm --filter=api db:migrate:create
# review apps/api/src/modules/db/migrations/Migration<timestamp>.ts
pnpm --filter=api db:migrate:up
```

Watch for MikroORM emitting DROP+ADD instead of RENAME, and NOT NULL columns added to
tables that already hold rows.
