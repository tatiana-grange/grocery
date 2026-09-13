# Phase 0 Research: Distribution — Distribution Screen, Express Order, Wallet Debit

Feature: [spec.md](./spec.md) · Branch: `feat/distribution`

Decisions taken before the design, each with the alternative that was rejected and why.
Section numbers are referenced from `plan.md`, `data-model.md`, and the contracts.

---

## 1. Two new modules: `distribution` and `wallet`

**Decision**: `distribution` owns `Handover` / `HandoverLine`, the distribution screen reads,
the express order, and the reversal. `wallet` owns `WalletEntry` and the balance. The
existing `orders`, `inventory`, `auth`, and `members` modules are extended, not replaced.

**Rationale**: both names are on the constitution's pre-approved module list (Principle III)
with exactly these responsibilities in the architecture plan — `distribution` is "distribution
screen: find member, adjust quantities, validate, express order" and `wallet` is "movement
ledger: top-ups, debits, refunds, credit notes — append only". Splitting them keeps the money
ledger usable by lot 5 (online top-up) and lot 7 (accounting) without either importing the
distribution screen. `distribution` depends on `wallet` the same way `purchasing` depends on
`inventory` today: a service method that takes the caller's `EntityManager` and joins its
transaction.

**Alternatives rejected**: one `distribution` module holding the ledger too — rejected because
lot 5 would then have to either import the distribution module to top up an account or move
the entity, and moving an append-only table between modules after it holds real money is the
one refactor worth avoiding. A standalone `payments` module for recording money received —
rejected because `payments` is reserved in the architecture plan for the online provider
integration (lot 5), and money received by hand is a wallet entry, not a payment integration.

---

## 2. The `distributor` role

**Decision**: add `'distributor'` to `USER_ROLES` in both places that declare it
(`apps/api/src/modules/auth/auth.config.ts` and
`apps/api/src/modules/members/contracts/member.contract.ts`), teach both `parseRoles`
implementations (`members.util.ts` and `apps/web-spa/app/features/common/lib/roles.ts`) to
accept it, and add one decorator:

```ts
/** Shorthand for @Roles('distributor', 'admin') — the distribution table. */
export const StaffOnly = () => SetMetadata(ROLES_KEY, ['distributor', 'admin'])
```

`ADMIN_USER_ROLES` stays `['admin']`.

**Rationale**: `AuthGuard` already reads `ROLES_KEY` generically and `auth.decorator.ts`
carries the comment "Generic so lot 4 can add `@Roles('grocer')` without touching the guard" —
lot 1 left the seam open (it names the role by its old name; see the rename note below). Keeping `distributor` out of `ADMIN_USER_ROLES` matters: that array is
what the Better Auth `admin` plugin treats as privileged, so a distributor must not be in it or it
would gain user banning and impersonation for free. Roles are stored as a comma-separated
string, so a distributor is `member,distributor` and an admin is `member,admin`; both `parseRoles`
functions currently hard-filter to `member | admin` and silently drop anything else, which is
why both must change or a distributor would read back as a plain member.

**Alternatives rejected**: a permission table — rejected as far more machinery than three
fixed roles need, and Principle V names exactly these three. Reusing `admin` with a UI-only
restriction — rejected because the restriction has to hold at the API, not the screen.

**Rename note.** Lots 1–3 reserved this role under the name `grocer`, in comments only — no
code ever used it. The maintainer renamed it to `distributor` before lot 4 was built, and the
constitution was amended to 1.3.0 to match (Principle V). Three code comments still say
`grocer` — `auth/auth.config.ts`, `auth/auth.decorator.ts`, and
`members/contracts/member.contract.ts` — and are corrected when this lot adds the role;
the third feeds the OpenAPI description, so editing it means regenerating the client.

**Admins reach distribution implicitly**, through the guard accepting either role, rather than
by literally carrying `distributor` in their role string. That matches how `admin` is already
"a strict superset of `member`" in this codebase, and needs no backfill for existing admins.
The consequence, chosen deliberately: distribution cannot be revoked from an admin without
removing `admin` itself.

---

## 3. `WalletEntry`: one signed, append-only table

**Decision**: one table. `amountCents` is a signed integer — negative charges the member,
positive credits them. A `reason` enum in the contract file says which kind of movement it is.
The balance is `SUM(amountCents)`, summed by the database, never stored on `Member`.

**Rationale**: Principle II is explicit — "member balance is always the sum of movement rows,
never a stored field that gets overwritten". One signed column makes the balance a single
`SUM`, makes "no row may ever be edited" one rule instead of two, and matches how
`StockMovement` already works (`buildStockLevel` sums one signed quantity column). Summing in
the database rather than loading the ledger follows `InventoryService.getStockLevels`, which
exists for the same reason: the ledger grows forever and a screen only needs the total.

**Alternatives rejected**: separate `credit` and `debit` tables — rejected because every read
becomes a union and the immutability rule has to be stated twice. A cached `balanceCents`
column on `Member` with a `CHECK (balanceCents >= 0)` — rejected outright: it is the stored
field Principle II forbids, and the check constraint would enforce the rule in the one place
nobody can see it.

---

## 4. Keeping the balance non-negative under concurrency

**Decision**: lock the `Member` row for the length of the transaction
(`LockMode.PESSIMISTIC_WRITE`), then sum the ledger, then compare, then write.

```ts
return this.em.transactional(async (em) => {
  const member = await em.findOne(Member, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
  const balanceCents = await this.wallet.getBalanceCents(em, member.id)
  if (totalCents > balanceCents) throw new ConflictException({ ... shortfallCents })
  // …create the handover, the stock movements, and the one wallet entry
})
```

**Rationale**: "refuse when the total exceeds the balance" (FR-027) is a read-then-write
decision, and without serialisation two handovers validated at the same moment could each read
the same 40 € and each charge 30 €, taking the member to −20 € and breaking SC-010. A row lock
on the member is the narrowest thing that serialises exactly the transactions that must not
interleave: two tills serving *different* members never wait on each other, and one member is
only ever at one table at a time, so in practice nothing ever queues. It is also a pattern this
codebase already runs — `PurchasingService.recordReception` takes
`LockMode.PESSIMISTIC_WRITE` on the supplier order for the same reason, and its comment
explains the same failure mode.

**Alternatives rejected**: `SERIALIZABLE` isolation with retry — rejected as a heavier
guarantee than one row needs, with no precedent in the codebase and a retry loop to get wrong.
Relying on `Member.version` optimistic locking — rejected because the handover does not modify
the member row, so there is nothing to bump and nothing to collide on. A database `CHECK` on a
derived balance — not expressible: the balance is a sum over another table.

---

## 5. Outbound stock movements keep the weighted average cost price correct

**Decision**: an outbound movement carries `quantity` negative and `unitCostAmountCents` set to
the product's **current weighted average cost, read inside the same transaction before the row
is appended**. `buildStockLevel` is left exactly as it is.

**Rationale**: `inventory.util.ts` derives the cost price as
`SUM(quantity × unitCostAmountCents) / SUM(quantity)`. Issuing `q` units valued at the current
average `a = N/Q` leaves that unchanged:

```
(N − q·a) / (Q − q)  =  (N − q·N/Q) / (Q − q)  =  (N·(Q−q)/Q) / (Q − q)  =  N/Q  =  a
```

So the one formula keeps serving both lots, no read path changes, and no query has to know
which rows are inbound. Stock level and cost price stay derived from exactly the same rows,
which is what makes them impossible to disagree. The cost is read before the write because the
new row would otherwise be part of its own input. Rounding the average to whole cents on each
issue leaves sub-cent drift on the numerator; over a cooperative's volumes this stays far below
one cent on the derived average, and it is the same rounding the rest of the app already
applies to money.

A product handed over with no reception history has no average; its outbound row carries
`unitCostAmountCents: 0`, which is honest — nothing was paid for it that the system knows of.

**Alternatives rejected**: excluding outbound rows from the cost calculation
(`WHERE reason = 'reception'`) — rejected because stock level and cost price would then sum
different row sets, which is exactly the drift Principle II exists to prevent, and it needs a
second grouped query. Storing a `costPriceCents` snapshot on `Product` — the forbidden stored
field. FIFO or lot-level costing — rejected as a costing method the cooperative has not asked
for; the architecture plan names weighted average.

---

## 6. `quantityOnHand` must stop being `nonnegative`

**Decision**: relax `stockSummarySchema.quantityOnHand` from `z.number().nonnegative()` to
`z.number()`, and let the stock screens render a negative figure as a warning rather than an
error. Regenerate the client (`pnpm generate`).

**Rationale**: the spec deliberately allows stock to go below zero — the shelf is the source of
truth at the table and refusing a real sale over a stale number would be worse (spec
Assumptions, FR-018). Lot 3 wrote `nonnegative()` when a reception was the only movement that
could exist. Leaving it would make the API fail its own response validation the first time a
product is over-distributed, turning a warning into a 500.

**Alternatives rejected**: clamping the derived level at zero — rejected because it hides the
signal that a stock count is needed and breaks SC-004 (level equals the sum of movements).

---

## 7. `Handover` and `HandoverLine` are write-once, like `Reception`

**Decision**: same shape and same rules as lot 3's `Reception` / `ReceptionLine` — `createdAt`
only, no `updatedAt`, never edited, never deleted. A mistake is corrected by recording a
reversing handover (§9).

**Rationale**: a handover is the record of a physical event that already happened, exactly like
a reception. Lot 3 recorded the "no `updatedAt` on a write-once row" deviation with the
reasoning that such a column would always equal `createdAt` and, if it ever moved, would signal
a bug rather than record history. The same reasoning applies unchanged, so this lot follows the
precedent rather than inventing a second convention. Keeping the handover separate from the
order is what lets staff adjust a quantity without editing lot 2's checkout snapshot on
`OrderLine`, which must stay exactly as checkout left it.

**Alternatives rejected**: writing the adjusted quantity back onto `OrderLine` — rejected
because that row is the immutable record of what the member ordered and at what price; the
difference between ordered and handed over is precisely the information FR-012 asks to keep
visible.

---

## 8. Every handover hangs off an `Order`, express orders included

**Decision**: an express order creates a real `Order` (`orderingMode: 'in_store'`) with its
`OrderLine`s at the table, then a `Handover` against it, all in one transaction. Every
`HandoverLine` therefore points at an `OrderLine`.

**Rationale**: one code path instead of two. The price snapshot, the member link, the order
history, the accounting exports of lot 7, and the member's own order list all keep working for
an express sale without a single special case. `OrdersService.checkout` already builds this
exact shape from a cart, and the express path reuses its `currentPrice(product)` pricing helper
so a line bought at the table is priced the same way a line bought online is.

**Alternatives rejected**: a standalone express sale with no order behind it — rejected because
every downstream read (member order history, exports, the reversal path) would need a second
shape. Routing express lines through the member's `Cart` — rejected because the cart is
member-owned and member-driven; staff writing into it would collide with whatever the member
has in it and would persist a draft the spec says must not exist before validation (FR-016).

---

## 9. Reversal points forward only

**Decision**: the reversing handover carries a `reversesHandover` foreign key to the one it
undoes. The original row gains nothing. "Has this handover been reversed?" is answered by
`WHERE reversesHandover = :id`.

**Rationale**: a back-pointer on the original would be a write to a row the previous section
just declared write-once, and the whole point of the reversal design is that history is never
touched. A single forward link gives the same information with no edit, and it is cheap to
query with an index.

The reversal writes, in one transaction: negative-quantity `HandoverLine`s mirroring the
original, one positive `WalletEntry` for exactly the original charge, positive `StockMovement`s
at **the same unit cost as the original outbound rows** (so the weighted average returns exactly
to where it was rather than to whatever the average is today), and it sets the order's status
back to `pending`. `Order` is a mutable entity with `version` and `updatedAt`, so moving its
status is a normal edit, not a ledger write — the same way `SupplierOrder.status` moves in
lot 3.

**Alternatives rejected**: a `reversedAt` column on the original handover — the forbidden edit.
Deleting the original — forbidden by FR-022 and Principle II. Partial (line-level) reversal —
out of scope by the spec's own assumption; reverse the handover and redo it.

---

## 10. "Ready to hand over" and "available quantity"

**Decision**: a pre-order line is ready when lot 3 set its `OrderLine.fulfilledAt`; an in-store
line is always ready. The **available quantity** shown next to the ordered quantity is simply
the product's current stock on hand, read through `InventoryService.getStockLevels`.

**Rationale**: lot 3 already marks a pre-order line fulfilled on the first reception covering
its product, and its spec says it did so precisely "so lot 4's distribution work can identify
pre-orders that are ready" — the seam is there, use it. For the short-delivery case (US1
scenario 6), current stock is the honest answer and needs no new machinery: it is the same
number the express order warns against, so the screen never shows two different ideas of what
is on the shelf.

**Alternatives rejected**: prorating a short delivery across the members who contributed to the
supplier order line — rejected as a fairness policy the cooperative has not decided, encoded in
code where nobody would see it. Staff are standing at the table and can decide who gets what;
the screen's job is to tell them how much there is.

---

## 11. Not charging twice

**Decision**: three layers. The member row lock (§4) serialises. The order-handover route takes
the `Order.version` the client loaded and refuses a stale one, matching
`PurchasingService.send` / `close`. The service refuses any order whose status is not
`pending`.

Express orders get no server-side idempotency key: the mutation is single-flight in the UI and
a duplicate is undone by reversing it.

**Rationale**: for an existing order, the version check plus the status check make a second
validation impossible — this is the mechanism SC-003 needs, and it is already proven in lot 3.
An express double-submit is a different problem: it creates two distinct orders, each charged
once, so SC-003 holds literally, and TanStack Query's mutation state disables the button while
the first is in flight.

**Recorded limitation**: a genuine double-submit of an express order (two rapid clicks that
both reach the server, or a retried request) produces two real orders and two real charges.
An idempotency key — a client-generated UUID with a unique index on `Handover` — would close
it for one extra column. It is left out because the lot is already large and the reversal path
exists, but it is the first thing to add if it ever happens in practice.

---

## 12. Recording money received

**Decision**: a positive `WalletEntry` with `reason: 'payment_received'`, a `paymentMethod` of
`cash | cheque | transfer`, and the staff user who recorded it. No reconciliation, no bank
feed, no cheque tracking.

**Rationale**: FR-026 asks for the record, not the treasury. The means matters because lot 7's
accounting export will need to split cash from bank, and capturing it now costs one column,
whereas backfilling it later is impossible. Recording who entered it is what makes a till
difference traceable to a shift.

**Recorded gap — correcting a mistyped payment.** FR-022 says every correction is a new entry,
and US6 gives staff a reversal for a handover, but nothing in the spec lets them undo a payment
entered with the wrong amount. A mistyped `120.00` instead of `12.00` would sit in the ledger
permanently. Closing it is small — a fourth reason value, one endpoint, one test, the same
shape as the handover reversal — but it is a requirement the spec does not currently carry, so
it is **not** built into the contracts below. Raise it before `/speckit.tasks` if it should be
in this lot.

---

## 13. The distribution surface is its own route group, not the back office

**Decision**: a new `distribution-layout.tsx` gated on distributor-or-admin, serving routes under
`/distribution`. The admin back office keeps its `isAdmin` gate untouched and gains a sidebar
link across to `/distribution`.

**Rationale**: `back-office-layout.tsx` gates on a single `isAdmin` check, and
`rbac-admin.spec.ts` asserts that exact behaviour — widening it to distributors would mean either
loosening the gate and then re-tightening every admin page behind it, or teaching one layout two
different access rules. A separate layout keeps one rule per surface. It also lets the table
screen have the shape it needs — large targets, few controls, a queue behind it — instead of
inheriting an admin sidebar built for browsing.

**Alternatives rejected**: `/admin/distribution` inside the back office with per-item nav
filtering — rejected for the two-rules-in-one-layout problem above and because a distributor landing
on an admin chrome full of links they cannot use is a worse screen.

---

## 14. E2E scope

The suite is `apps/web-spa-e2e` (Playwright, `pnpm e2e`), with sessions seeded per role by
`auth.setup.ts` from `apps/api/src/seeders/e2e.fixtures.ts`. This lot must:

- add a `distributor` account to `E2E_USERS`, add `'distributor'` to the `Role` union in `env.ts` and to
  `withRole` in `fixtures.ts`, and add it to the loop in `auth.setup.ts`;
- add `E2E_DISTRIBUTION` fixtures — a member with a fulfilled pre-order, an in-store order, a
  funded balance, and a second member left at a zero balance for the refusal path — isolated
  from the lot 2 and lot 3 fixtures the way `E2E_PURCHASING` already is;
- cover: the distribution screen (find, ready vs not ready, balance), a handover with an
  adjusted quantity, the refusal on an insufficient balance and the pay-then-retry, an express
  order, a reversal, the waiting lists, and the `distributor` role boundary (reaches
  `/distribution`, refused on `/admin/*`).

Per the plan's E2E gate: the feature is only done when the whole `pnpm e2e` suite passes, and a
failing spec blocks it until a human decides whether the test or the behaviour is wrong.

---

## 15. Unit tests the constitution requires outright

Principle IV: "Money, stock, and sale-by-weight logic MUST have tests before the feature is
considered done." That names, concretely:

- balance derivation and the insufficient-balance comparison, including the exact-match boundary
  (total equals balance → allowed);
- the handover total recomputed from adjusted quantities at the order's snapshot prices;
- the outbound movement's unit cost, and the proof in §5 held as a test: receive at two
  different costs, issue some, assert the weighted average is unchanged;
- a by-weight line handed over at a weight different from the one ordered;
- the reversal returning both balance and stock to their exact prior values.
