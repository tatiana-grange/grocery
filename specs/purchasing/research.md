# Phase 0 Research: Purchasing — Aggregate Pre-orders, Receive, Stock, Cost Price

No `NEEDS CLARIFICATION` markers remain in the Technical Context — this project's stack,
testing tools, and conventions are fixed by the constitution and by the lot 1/lot 2
precedent. The decisions below are about how lot 3 fits into that existing shape, not about
picking a stack.

## 1. Two new modules, split the way the architecture plan already describes

**Decision**: Introduce **`purchasing`** (`SupplierOrder`, `SupplierOrderLine`, `Reception`,
`ReceptionLine`) and **`inventory`** (`StockMovement`, current-stock/cost-price reads) as
two separate NestJS modules, both already named on the constitution's pre-approved module
list (Principle III).

**Rationale**: The architecture plan assigns "aggregate pre-orders into a supplier order,
reception, discrepancies" to `purchasing` and "stock, weighted average cost price,
inventory counts, adjustments" to `inventory` as two distinct responsibilities. Lot 3's
one-line scope ("aggregate ... reception, stock, cost price") pulls in a slice of each,
not all of either — the reception/discrepancy half of `purchasing`, and the
stock-level/cost-price-read half of `inventory`, with counts and adjustments left for a
later inventory increment (spec Assumptions). Keeping the split now means lot 3 does not
have to be reshuffled when the later increment adds counts and adjustments to `inventory`.

**Alternatives considered**:
- *One `purchasing` module holding everything, including `StockMovement`* — rejected: it
  would need to be split apart again the moment counts/adjustments are built, and it blurs
  a module boundary the constitution already draws.
- *Put `StockMovement` in `catalog`* (`catalog` already owns `Product`/`ProductPrice`) —
  rejected: `catalog` is presentation/reference data (what a product is, what it costs to
  buy); stock is operational ledger data with a different write pattern (append-only,
  transactional) and its own constitution principle (II). Mixing them would make `catalog`
  harder to reason about for the exact reason Principle II exists.

## 2. Aggregation query: "pending and not yet linked" pre-order lines

**Decision**: Aggregation for a supplier selects every `OrderLine` where its parent `Order`
has `orderingMode = 'pre_order'` and `status = 'pending'`, the line's `product.supplier`
matches the chosen supplier, and the line has no `supplierOrderLine` link yet (see §3). It
groups the selected lines by `product`, sums `quantity`, and creates one `SupplierOrderLine`
per product on a new `SupplierOrder` in status `draft`.

**Rationale**: This directly implements FR-001/FR-002/FR-005: only unlinked lines are
picked up, quantities are summed per product, and a line that arrives after an order was
already created is naturally left alone (it has no link yet, so the *next* aggregation run
for that supplier picks it up). No new "already aggregated" flag is needed beyond the link
itself — one less piece of state to keep in sync.

**Alternatives considered**: A separate `aggregatedAt` timestamp on `OrderLine` instead of
a link — rejected: it would answer "was this touched" but not "by which supplier order",
losing the FR-002 traceability requirement for no extra benefit.

## 3. Linking a member's pre-order line to a supplier-order line

**Decision**: Add two nullable columns to the existing `OrderLine` entity (lot 2, `orders`
module): `supplierOrderLine` (`ManyToOne` → `purchasing.SupplierOrderLine`, nullable) and
`fulfilledAt` (`Date`, nullable). Aggregation sets `supplierOrderLine` once, when the line
is absorbed into a supplier order. Reception sets `fulfilledAt` once, the first time a
reception for that product against that supplier order is confirmed (see §6).

**Rationale**: An `OrderLine` is created once at checkout and never mutated for its
*checkout* data (product, quantity, price — lot 2's immutability note). These two new
columns are bookkeeping about what happened to the line *afterward*, set exactly once each,
never reverted — closer to "recording a fact that becomes true" than "editing history".
This is not the append-only ledger Principle II protects (`WalletEntry` / `StockMovement`);
it is the same category of one-time transition lot 2 already used for `Order.cancelledAt`.
A join-table alternative was considered and rejected as needless normalization: an
`OrderLine` can be linked to at most one `SupplierOrderLine` ever (aggregation consumes a
pending line whole, never splits it across two supplier orders), so a nullable FK captures
the relationship exactly, with no multiplicity to model.

**Alternatives considered**: A separate `SupplierOrderLineSource` join entity
(`supplierOrderLine`, `orderLine`, `quantity`) — rejected as over-normalized for a
relationship that is always 1:1 once set; it would add a table and a migration for
information the two nullable columns already capture, and it still would not avoid a
one-time write to something touching `OrderLine`.

## 4. Stock level and cost price are always computed, never stored

**Decision**: `StockMovement` rows are the only source of truth. For a given product:
- **Stock level** = `SUM(quantity)` across its movements.
- **Weighted average cost price** = `SUM(quantity * unitCostAmountCents) / SUM(quantity)`
  across its movements.

Both are computed by an aggregate query in `InventoryService` every time they are read;
neither is cached on `Product` or anywhere else.

**Rationale**: This is Principle II applied literally ("never a stored field you
overwrite") and mirrors the existing `ProductPrice` pattern, where "the current price" is
derived by finding the open row rather than kept in a cached column. In lot 3 every
`StockMovement` is an inbound reception with a positive quantity and a unit cost, so both
formulas reduce to a plain weighted average; the shape already accommodates a future
signed, sometimes-costless movement (a lot 4 distribution debit) without a schema change —
that extension is not built now, only left room for.

**Alternatives considered**: Store `quantityOnHand` and `costPriceAmountCents` on `Product`,
updated transactionally on each reception — rejected: it is exactly the "stored field that
gets overwritten" Principle II forbids for stock, and it would need a reconciliation job to
guard against drift that the derived-query approach makes structurally impossible.

## 5. Discrepancy flagging reuses the lot 1 weight-tolerance fields

**Decision**: A reception line's discrepancy flag compares `receivedQuantity` to its
`SupplierOrderLine.quantity` (the aggregated ordered amount). For a unit-sold product, any
non-zero difference is flagged. For a by-weight product, the existing
`Product.averageWeightGrams` / `Product.weightTolerancePercent` fields (added in lot 1,
already commented "reserved for lot 3 pre-order weight estimates; unused in lot 1") set
the tolerance band: a difference within the band is recorded but not flagged as a
discrepancy; a difference outside it is flagged. Either way, per FR-012 and the spec's
Assumptions, a flag is informational and never blocks confirming the reception.

**Rationale**: Gives those two lot 1 fields their first real consumer instead of leaving
them dead, and matches the spec's framing that weight is "necessarily approximate at
pre-order time" — a small variance is expected and normal, a large one is worth a human
glance.

**Alternatives considered**: Flag every non-zero difference regardless of sale mode —
rejected: it would make discrepancy flags meaningless noise for by-weight products, where a
difference is the norm, not the exception, defeating the point of flagging at all.

## 6. Fulfilling a pre-order line: first reception of its product wins

**Decision**: When a reception line is confirmed for a `SupplierOrderLine`'s product, every
`OrderLine` linked to that `SupplierOrderLine` that does not yet have `fulfilledAt` set gets
it set to that reception's confirmation time. A later, second reception against the same
supplier order (§ US3 AC7) does not re-touch already-fulfilled lines.

**Rationale**: Matches FR-024's literal wording — "once the reception covering its product
is confirmed" — which does not require the full ordered quantity to have arrived, only that
some delivery for it has. Lot 4 (out of scope here) decides how to use this per-line signal
to build its distribution lists; lot 3 does not attempt to roll it up into a new
`Order.status` value, since a single pre-order `Order` can span lines from more than one
supplier, each fulfilled on its own delivery schedule.

**Alternatives considered**: Only mark fulfilled once the supplier order line's full
ordered quantity has been received across all its receptions — rejected: it contradicts the
spec's own edge case that a short delivery still updates stock and is usable, and it would
leave a partially-but-substantially-delivered pre-order line unmarked indefinitely if a
supplier never sends the remainder.

## 7. Receptions are corrected the same way `OrderLine` handles immutability

**Decision**: `Reception` and `ReceptionLine` carry `createdAt` but no `updatedAt`, the
same deviation lot 2 already recorded for `OrderLine`, for the same reason: these rows are
written once and never edited. A correction (FR-014) is a brand-new `Reception` (with its
own `ReceptionLine`s, potentially negative-intent lines are not needed — a correction adds
the missing amount or is offset by never having been recorded wrong in stock: since stock
is derived from `StockMovement` sums, a correcting reception simply adds another movement
with the right delta) against the same `SupplierOrderLine`s, so history stays a plain,
readable list of what actually happened, in order.

**Rationale**: One rule ("a past reception is never touched") instead of two different
immutability stories for two structurally identical kinds of ledger-adjacent rows.

## 8. Supplier-order totals are estimates, computed at read time

**Decision**: A `SupplierOrder`'s "total" (shown to staff before it is sent — US2 AC1) is
computed, not stored: for each line, use the product's current weighted average cost price
from `InventoryService` if the product has ever been received before; otherwise the line's
cost is shown as not yet known and excluded from the total, with the order flagged as a
partial estimate. Once receptions exist, the *actual* amount paid is visible from the
receptions themselves (FR-010), which is the number that matters for real accounting.

**Rationale**: There is no purchase-cost field anywhere in the catalog before a product has
ever been received — `ProductPrice` is the customer-facing sale price, not what the
cooperative pays the supplier. Treating the pre-reception total as a best-effort estimate,
rather than inventing a stored "expected cost" field that could go stale, keeps every
number in the system traceable to either a real reception or an explicit "unknown" label.

**Alternatives considered**: Add a `supplierCostAmountCents` field to `Product`, maintained
by staff — rejected: out of scope for lot 3 as specified (no admin "set supplier cost"
workflow is in the spec), and it would duplicate what the weighted average cost price
already derives correctly once at least one reception exists.

## 9. E2E scope

**Decision**: This feature is staff-facing only (no public shop or member-area change), so
its Playwright coverage lives under `apps/web-spa-e2e/tests/` as new admin-flow specs,
following the existing `admin-members` / `catalog` precedent rather than the shop/cart
specs from lot 2.

**Rationale**: `apps/web-spa-e2e` (Playwright, `pnpm e2e`) is confirmed present in this
repo. Per project convention, this feature ships its own E2E specs and is only done when
the full `pnpm e2e` suite passes; a failing E2E test blocks the feature until a human
decides whether to fix the test or the behavior.
