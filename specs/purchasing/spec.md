# Feature Specification: Purchasing — Aggregate Pre-orders, Receive, Stock, Cost Price

**Feature Branch**: `feat/purchasing`
**Created**: 2026-09-05
**Status**: Draft
**Input**: User description: "Lot 3 — Purchasing : agréger les précommandes en commande fournisseur, réception, stock, prix de revient"

## Context

This is delivery lot 3 of the participative grocery app (the "Purchasing" lot in the
architecture plan). It turns the pending pre-orders recorded by lot 2 into goods the
cooperative actually has on hand:

1. **Aggregation** — every member's pre-order for a supplier's products is combined into
   one supplier order, so the cooperative places a single order per supplier instead of one
   per member.
2. **Reception** — when the delivery arrives, staff record what was actually received,
   which may differ from what was ordered (short delivery, over-delivery, or an
   approximate weight for products sold by weight).
3. **Stock and cost price** — receiving goods is the only way stock increases in this lot.
   Every reception is recorded as a permanent movement, and each product's cost price is
   recalculated as a weighted average across everything received.

Lot 3 stops before the distribution screen, express orders, and any wallet or payment
movement — those belong to lot 4. It also stops before stock counts and manual adjustments
(shrinkage, breakage, corrections outside a reception), which belong to a later inventory
increment. In lot 3, receiving goods records that they arrived and are now on the shelf; it
does not yet hand them to a member.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aggregate pending pre-orders into a supplier order (Priority: P1)

Staff pick a supplier and ask the system to combine every member's still-pending pre-order
for that supplier's products into one draft supplier order. Quantities for the same product
from different members are summed into a single line.

**Why this priority**: Without aggregation, nothing else in this lot has anything to work
with — there is no supplier order to send, receive, or use to update stock.

**Independent Test**: With pre-orders from at least two different members for the same
supplier, some sharing a product, trigger aggregation and confirm one draft supplier order
is created with one line per product, quantities correctly summed, and every contributing
member pre-order line linked to it.

**Acceptance Scenarios**:

1. **Given** several members have pending pre-orders for products from the same supplier,
   **When** staff aggregate that supplier's pending pre-orders, **Then** one draft supplier
   order is created with one line per distinct product and the ordered quantity on each
   line equal to the sum of every contributing member's requested quantity.
2. **Given** two members each have a pending pre-order for the same product, **When** the
   supplier order is created, **Then** the supplier order shows a single combined line for
   that product, and each member's original pre-order line remains individually visible as
   part of what was aggregated.
3. **Given** a supplier has no pending pre-orders at all, **When** staff try to aggregate for
   that supplier, **Then** no supplier order is created and staff are told there was nothing
   to aggregate.
4. **Given** a pre-order line's product can no longer be ordered from its supplier (for
   example, the product was archived after the pre-order was placed), **When** aggregation
   runs, **Then** that line is left out of the supplier order and staff are shown which
   product and pre-order were skipped and why.
5. **Given** a supplier order has already been created for a supplier, **When** new
   pre-orders for that same supplier arrive afterward, **Then** they are left pending and
   are picked up the next time staff aggregate that supplier, not merged into the
   already-created order.

---

### User Story 2 - Send a supplier order (Priority: P1)

Staff review a draft supplier order — its lines, quantities, and total — and mark it as
sent to the supplier. Once sent, its lines are fixed: later pre-orders for that supplier no
longer change it.

**Why this priority**: Placing the order with the supplier is the point of no return before
a real delivery; the workflow cannot proceed to reception without it.

**Independent Test**: Create a draft supplier order, review its content, mark it sent, and
confirm its status changes and its lines can no longer be altered by a new aggregation run.

**Acceptance Scenarios**:

1. **Given** a draft supplier order, **When** staff review it, **Then** they see every line,
   its product, quantity, and the order's total.
2. **Given** a draft supplier order, **When** staff mark it sent, **Then** its status changes
   to sent and a summary staff can hand or send to the supplier is available.
3. **Given** a supplier order already marked sent, **When** staff try to mark it sent again,
   **Then** the action is refused with an explanation.
4. **Given** a supplier order marked sent, **When** a later aggregation run happens for the
   same supplier, **Then** that sent order's lines are unaffected — only a new draft order
   picks up the newly pending pre-orders.

---

### User Story 3 - Receive a delivery and watch stock and cost price update (Priority: P1)

When a delivery arrives, staff open the matching sent supplier order and record what was
actually received, line by line. The system compares received quantities to what was
ordered and flags any difference. As soon as a reception is confirmed, the received goods
are added to stock and each product's cost price is recalculated from what was actually
paid.

**Why this priority**: This is the moment pre-orders become real stock the cooperative can
distribute — the core value of the whole lot.

**Independent Test**: Take a sent supplier order, record a reception where one line matches
what was ordered and another is short, confirm it, and verify: stock increased by exactly
the received amounts, the short line is flagged, and each received product's cost price
reflects the reception.

**Acceptance Scenarios**:

1. **Given** a sent supplier order, **When** staff record a reception with the quantity
   actually received for each line, **Then** the system compares each received quantity to
   its ordered quantity and flags any line where they differ.
2. **Given** a reception is confirmed, **When** staff check stock afterward, **Then** every
   received product's stock level has increased by exactly the quantity recorded as
   received on that reception — not the quantity that was ordered.
3. **Given** a reception is confirmed, **When** staff check a received product's cost price
   afterward, **Then** it reflects a weighted average that includes this reception's
   received quantity and unit cost alongside everything received before it.
4. **Given** a product sold by weight, **When** staff record its received weight and that
   weight differs from the pre-order's estimated weight, **Then** the difference is recorded
   and used for stock and cost price without being treated as an error requiring correction.
5. **Given** a reception was confirmed with a mistake (for example, a mistyped quantity),
   **When** staff fix it, **Then** the fix is recorded as a new adjusting entry — the
   original reception record is never edited or deleted.
6. **Given** a supplier order line was received with more than was ordered, **When** the
   reception is confirmed, **Then** the line is flagged as over-delivered and the full
   received quantity (not just the ordered quantity) is added to stock and used in the cost
   price calculation.
7. **Given** a supplier delivers a sent order in more than one shipment, **When** staff
   record a second reception against the same supplier order, **Then** the second
   reception's quantities add to stock and cost price on top of the first, and each
   reception remains individually visible in the order's history.

---

### User Story 4 - Check a product's current stock and cost price (Priority: P2)

Staff look up any product and see how much is currently on the shelf and its current
weighted average cost price, at any time — not only right after a reception.

**Why this priority**: A live number staff can trust is what makes the rest of the lot
useful day to day, but the workflow above already delivers stock and cost price as a
side effect, so this is a viewing convenience rather than new behavior.

**Independent Test**: After one or more receptions for a product, look it up and confirm
the displayed stock level and cost price match what the receptions produced, independent of
placing or receiving any other order.

**Acceptance Scenarios**:

1. **Given** a product has received stock from one or more receptions, **When** staff look
   it up, **Then** they see its current stock level and current weighted average cost
   price.
2. **Given** a product has never been received, **When** staff look it up, **Then** its
   stock level shows as zero and it has no cost price yet.
3. **Given** two different receptions brought in the same product at two different unit
   costs, **When** staff check its cost price, **Then** the figure shown is the weighted
   average across both, weighted by the quantity received each time.

---

### User Story 5 - Close out a supplier order that will not be fully honored (Priority: P2)

Sometimes a supplier cannot deliver everything that was ordered (a stockout, a discontinued
product). Staff mark the supplier order as closed once no further delivery is expected,
even if some lines were never fully received.

**Why this priority**: Keeps the list of orders awaiting delivery accurate and prevents a
partially-delivered order from sitting open forever, but the cooperative can operate for a
while without it — nothing downstream is blocked by an order staying open.

**Independent Test**: Take a sent supplier order with one line partially received, close it
out, and confirm its status reflects that no further delivery is expected while its
reception history and the stock already received remain untouched.

**Acceptance Scenarios**:

1. **Given** a sent supplier order with at least one line not fully received, **When** staff
   close it out, **Then** its status shows no further delivery is expected, and the stock
   and cost price already recorded from receptions already confirmed are left exactly as
   they were.
2. **Given** a supplier order has been closed, **When** staff try to record a further
   reception against it, **Then** the action is refused with an explanation.

---

### Edge Cases

- What happens when staff try to aggregate a supplier that has some eligible pre-orders and
  some already-aggregated ones mixed together? Only the not-yet-aggregated pre-order lines
  are picked up; already-aggregated ones are left exactly where they are.
- What happens when a reception is recorded with a received quantity of zero for a line (the
  product simply did not arrive)? It is recorded as zero received, the line is flagged as
  fully short, and stock and cost price for that product are unaffected by that line.
- What happens if staff try to record a reception against a supplier order that is still a
  draft (never sent)? Reception is refused with an explanation that the order must be sent
  first.
- What happens if staff try to record a reception against a supplier order that is already
  closed? Reception is refused with an explanation.
- What happens when every line of a sent supplier order has been fully received? The order's
  status reflects that it is fully received, distinguishing it from one closed early with
  outstanding lines.
- What happens to a member's pre-order once its product has been received? It is marked as
  fulfilled so the distribution work in lot 4 can find pre-orders that are ready, but it is
  not yet handed to the member — that remains lot 4's job.

## Requirements *(mandatory)*

### Functional Requirements

#### Aggregation into supplier orders

- **FR-001**: The system MUST let staff aggregate, per supplier, every pending pre-order
  line for that supplier's products that has not already been aggregated into a supplier
  order, combining quantities for the same product across members into a single line.
- **FR-002**: The system MUST keep a link from each supplier-order line back to every member
  pre-order line that contributed to it, so member-level detail is never lost behind the
  combined total.
- **FR-003**: The system MUST leave out, rather than block on, a pre-order line whose
  product can no longer be ordered from its supplier at aggregation time, and MUST report to
  staff which product and pre-order were skipped and why.
- **FR-004**: The system MUST refuse to create an empty supplier order and MUST tell staff
  there was nothing pending to aggregate for that supplier.
- **FR-005**: The system MUST leave a pre-order untouched, available for a future
  aggregation run, when it arrives for a supplier that already has an existing draft or sent
  supplier order.

#### Sending a supplier order

- **FR-006**: The system MUST let staff review a draft supplier order's lines, quantities,
  and total before sending it.
- **FR-007**: The system MUST let staff mark a draft supplier order as sent, after which its
  lines are fixed and no longer receive newly aggregated pre-orders.
- **FR-008**: The system MUST refuse to mark an already-sent or already-closed supplier
  order as sent again, with an explanation.
- **FR-009**: The system MUST make a reviewable or exportable summary of a sent supplier
  order available to staff, for communicating the order to the supplier.

#### Reception

- **FR-010**: The system MUST let staff record a reception against a sent supplier order,
  capturing the quantity actually received and the unit cost for each line.
- **FR-011**: The system MUST compare each reception line's received quantity to its
  supplier-order line's ordered quantity and flag a discrepancy whenever they differ, in
  either direction.
- **FR-012**: The system MUST accept a received weight for a by-weight product that differs
  from its pre-order's estimated weight without requiring a correction step, since weight is
  necessarily approximate at pre-order time.
- **FR-013**: The system MUST let staff record more than one reception against the same
  supplier order, so a delivery that arrives in more than one shipment is fully captured,
  and MUST keep every reception individually visible in the order's history.
- **FR-014**: The system MUST let staff correct a mistake in a previously recorded reception
  only by recording a new adjusting entry, and MUST NOT allow a past reception record to be
  edited or deleted.
- **FR-015**: The system MUST refuse to record a reception against a supplier order that is
  still a draft or already closed, with an explanation.

#### Stock and cost price

- **FR-016**: The system MUST increase a product's stock level, at the moment a reception is
  confirmed, by exactly the quantity recorded as received on that reception — never by the
  quantity that was ordered.
- **FR-017**: The system MUST record every stock change as a permanent, append-only
  movement; a product's stock level MUST always be derivable as the sum of its movements,
  never stored as a field that gets directly overwritten.
- **FR-018**: The system MUST recalculate a product's weighted average cost price every time
  stock is received for it, weighting each reception by the quantity received at that
  reception's unit cost.
- **FR-019**: The system MUST let staff view, for any product, its current stock level and
  current weighted average cost price at any time, not only immediately after a reception.
- **FR-020**: The system MUST show a product with no reception history as having zero stock
  and no cost price yet, rather than an error or a blank value.

#### Closing a supplier order

- **FR-021**: The system MUST let staff close a sent supplier order that will not be fully
  honored, marking it as no longer expecting further delivery while leaving every reception
  already confirmed against it untouched.
- **FR-022**: The system MUST refuse to record a reception against a closed supplier order,
  with an explanation.
- **FR-023**: The system MUST distinguish, in a supplier order's status, between an order
  that is fully received and one that was closed early with lines still outstanding.

#### Traceability into distribution

- **FR-024**: The system MUST mark a member's pre-order as fulfilled once the reception
  covering its product is confirmed, so that lot 4's distribution work can identify
  pre-orders that are ready, without itself handing goods to the member.

### Key Entities *(include if feature involves data)*

- **Supplier order**: A single order placed with one supplier, aggregated from every
  member pre-order pending for that supplier's products at the time of aggregation. Holds a
  status (draft, sent, fully received, or closed), the date sent, and a total.
- **Supplier order line**: One product on a supplier order, with the combined ordered
  quantity and links back to every contributing member pre-order line.
- **Reception**: A record of goods physically received against a sent supplier order, made
  at a point in time. A supplier order can have more than one reception if delivered in
  several shipments.
- **Reception line**: One product on a reception, with the quantity actually received and
  the unit cost paid, compared against its supplier-order line's ordered quantity to
  surface any discrepancy.
- **Stock movement**: A permanent, append-only record of a change in a product's stock
  level, created by a reception. A product's stock level is always the sum of its
  movements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can turn every pending pre-order for one supplier into a single,
  correctly-summed draft supplier order in one action, regardless of how many members
  contributed pre-orders.
- **SC-002**: 100% of a member's pre-ordered quantity for a supplier's product is
  represented, exactly once, across that supplier's supplier orders — no quantity is lost or
  double-counted by aggregation.
- **SC-003**: 100% of stock added to the system can be traced back to the specific reception
  — and from there to the supplier order — that brought it in.
- **SC-004**: A product's displayed stock level matches the sum of its recorded stock
  movements with zero discrepancy, every time it is checked.
- **SC-005**: Staff can record a reception, including any discrepancies, and see the
  resulting stock level and cost price update immediately after confirming it.
- **SC-006**: 100% of confirmed receptions remain in the system unchanged forever; every
  correction after the fact appears as an additional, separately visible entry rather than
  an edit to history.
- **SC-007**: Staff can find a product's current weighted average cost price, reflecting
  every reception to date, at any time without needing to review past receptions by hand.

## Assumptions

- **Aggregation is staff-triggered, per supplier**, not scheduled automatically. Staff
  choose when to aggregate a given supplier's pending pre-orders (for example, ahead of a
  known delivery day). Producer collection planning and scheduling are a separate, later
  concern.
- **Staff acting in this lot are admins.** The `grocer` role does not exist until lot 4
  (per the lot 1 note), so aggregation, sending, reception, and closing supplier orders are
  admin actions in lot 3. Lot 4 can extend these actions to the `grocer` role once it
  exists.
- **A product belongs to exactly one supplier**, per the lot 1 catalogue, so aggregating
  "by supplier" and aggregating "by product's supplier" are the same operation. There is no
  cross-supplier product to reconcile.
- **Sending a supplier order does not require actual outbound delivery (email, fax, etc.)
  to the supplier in this lot.** Marking an order sent and producing a reviewable/exportable
  summary is enough; wiring an automatic email-with-CSV to the supplier, and the supplier
  portal, are later, separate work.
- **No manual stock adjustments or physical inventory counts in lot 3.** The only way stock
  moves in this lot is a reception. Shrinkage, breakage, and count-based corrections are a
  later inventory increment, not part of aggregating, receiving, or costing what a supplier
  delivers.
- **Deposit products (consigne), supplier credit notes, and paid transport (FRET) are not
  part of this lot.** They are called out as risks and future admin-billing features in the
  architecture plan, but the lot 3 scope as described is aggregation, reception, stock, and
  cost price only.
- **Cost price means the weighted average unit cost paid to the supplier for what was
  received** — it does not include transport, handling, or other overhead, none of which
  are captured in this lot.
- **A discrepancy (short or over delivery) is recorded and shown to staff; it does not block
  confirming the reception or require a separate approval step.** Staff can act on a flagged
  discrepancy (for example, follow up with the supplier) outside the system.
- **Fulfilling a pre-order (FR-024) only marks it ready; it does not change what a member
  sees or owes.** Notifying the member and handing over the goods remain lot 4's
  distribution work.

## Dependencies

- Requires the lot 1 catalogue (suppliers, categories, products, prices) and the lot 2
  pre-order records (pending `Order` / `OrderLine` rows with ordering mode `pre_order`).
- Lot 4 (distribution) will read fulfilled pre-orders to build its distribution lists and
  will be the point where the `grocer` role and wallet debits are introduced.
- A later inventory increment will extend stock with manual counts and adjustments, on top
  of the stock movements this lot introduces from receptions.

## Out of Scope

- The distribution screen, express order, wallet debit, and the `grocer` role (lot 4).
- Online payment, wallet top-up, and payment-provider integration (lot 5).
- Manual stock adjustments and physical inventory counts (a later inventory increment).
- Deposit products (consigne), supplier credit notes, invoice disassociation, and paid
  transport (FRET) mode.
- Automatic outbound communication (email, CSV attachment) to the supplier, and the
  automatically generated supplier portal.
- Producer collection planning and scheduling.
- Group order between cooperatives, and every item already out of scope for the whole app
  (multi-site hosting, cooperative directory, announcements, services/hour-exchange, BAR
  module).
