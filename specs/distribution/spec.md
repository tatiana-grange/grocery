# Feature Specification: Distribution — Distribution Screen, Express Order, Wallet Debit

**Feature Branch**: `feat/distribution`
**Created**: 2026-09-12
**Status**: Draft
**Input**: User description: "4. Distribution — écran de distribution, commande express, débit du portefeuille. ~2-3 semaines"

## Context

This is delivery lot 4 of the participative grocery app (the "Distribution" lot in the
architecture plan). It is the moment goods leave the cooperative and money leaves the
member's account. It closes the cycle the first three lots opened: order (lot 2), buy and
receive (lot 3), distribute and pay (lot 4).

1. **Distribution screen** — a member arrives at the table during a distribution. Staff find
   them, see everything they have waiting, adjust each line to what is actually handed over
   (a weighed product is never exactly the weight that was pre-ordered), and validate.
2. **Express order** — a member who did not pre-order takes something off the shelf. Staff
   build the order at the table from current stock and validate it in the same motion.
3. **Wallet debit** — validating a handover charges the member's account. This lot
   introduces the member balance as an append-only ledger: every euro in or out is a row,
   the balance is always the sum of those rows, and a mistake is corrected by a reversing
   row, never by editing history.

This lot also introduces the **`distributor` role**: a member trusted to staff a distribution,
who can use the distribution screen and take payment, but who is not an admin and cannot
touch the catalogue, suppliers, purchasing, or member administration.

Lot 4 stops before online top-up and any payment provider (lot 5), participation planning
(lot 6), and accounting exports (lot 7).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a member and see everything they have to collect (Priority: P1)

A member arrives at the distribution table. Staff search for them by name or membership
number and immediately see, on one screen, every order of theirs that is still waiting:
pre-orders whose goods have arrived, in-store orders, and — for each — the products,
quantities, and amounts. Lines whose goods have not arrived yet are shown as not ready, so
staff never promise something that is not on the shelf.

**Why this priority**: Nothing else at the table can happen until staff can see who the
member is and what is theirs. On its own this already replaces the paper list staff would
otherwise work from.

**Independent Test**: With a member who has one pre-order covered by a confirmed reception,
one pre-order not yet received, and one in-store order, search for that member and confirm
all three appear, correctly separated into ready and not ready, with no handover performed.

**Acceptance Scenarios**:

1. **Given** a member with orders still to collect, **When** staff search by their name,
   **Then** the member is found and their outstanding orders are listed with each product,
   quantity, and amount.
2. **Given** a member with orders still to collect, **When** staff search by their
   membership number, **Then** the same member is found.
3. **Given** a member's pre-order whose goods have been received, **When** staff open the
   distribution screen for that member, **Then** the order is shown as ready to hand over.
4. **Given** a member's pre-order whose goods have not been received, **When** staff open
   the distribution screen for that member, **Then** the order is shown as not ready, with
   the reason, and cannot be validated.
5. **Given** a member with nothing outstanding, **When** staff open their distribution
   screen, **Then** staff are told there is nothing to collect, and the express-order path
   is still available.
6. **Given** a member's order that was short-delivered by the supplier, **When** staff open
   the distribution screen, **Then** the line shows how much is actually available against
   how much was ordered.
7. **Given** a member's current account balance, **When** staff open their distribution
   screen, **Then** the balance is visible alongside the amount about to be charged.

---

### User Story 2 - Hand over an order and charge the member (Priority: P1)

Staff go through the order line by line with the member, correcting each quantity to what is
actually handed over — a weighed product is put on the scale, a member declines an item, a
short delivery means less than was ordered. Staff validate. In one step the order is marked
handed over, the stock of every product given out goes down by the quantity handed over, and
the member's account is charged the recalculated total.

**Why this priority**: This is the lot. Goods move and money moves, and both must move
together or not at all.

**Independent Test**: Take a member order with two lines, reduce one quantity and leave the
other, validate, and confirm: the order is handed over, stock fell by exactly what was
handed over, the amount charged matches the adjusted total, and one ledger entry records
the charge.

**Acceptance Scenarios**:

1. **Given** a ready order, **When** staff change a line's quantity to what is actually
   handed over, **Then** the line amount and the order total are recalculated at the price
   recorded when the order was placed, and the new total is shown before validating.
2. **Given** an adjusted order, **When** staff validate the handover, **Then** the order is
   marked handed over, each product's stock decreases by exactly the quantity handed over,
   and the member's account is charged the adjusted total.
3. **Given** a handover has been validated, **When** anyone looks at the member's account,
   **Then** exactly one charge appears for that handover, showing the amount, the date, and
   which order it relates to.
4. **Given** a product sold by weight pre-ordered at an estimated weight, **When** staff
   enter the weight actually put on the scale, **Then** the member is charged for the actual
   weight, not the estimate, and the difference is not treated as an error.
5. **Given** a line the member declines entirely, **When** staff set its quantity to zero and
   validate, **Then** nothing is charged and no stock moves for that line, while the rest of
   the order is handed over normally.
6. **Given** a validated handover, **When** staff try to validate the same order again,
   **Then** the action is refused with an explanation and the member is not charged twice.
7. **Given** two staff members open the same order at the same time, **When** one validates
   it, **Then** the other's attempt is refused with an explanation rather than producing a
   second charge.
8. **Given** a member who only wants part of their order today, **When** staff hand over some
   lines and leave the rest, **Then** what was handed over is charged and the remainder stays
   outstanding for a later distribution.
9. **Given** a handover total higher than the member's balance, **When** staff validate it,
   **Then** the handover is refused, the shortfall is shown, nothing is charged and no stock
   moves — and staff can record a payment on the spot and validate again.

---

### User Story 3 - Express order at the table (Priority: P1)

A member arrives without having ordered, or adds something on top of what they came for.
Staff build an order at the table from what is currently on the shelf — searching by product
name or barcode — set quantities or weights, and validate it in a single step. The order is
created, the goods leave stock, and the member is charged, all at once.

**Why this priority**: Most visits to a participative grocery include something bought on the
spot. Without it staff fall back to paper and the stock figures drift out of date the same
day.

**Independent Test**: With a member who has no outstanding order, build an express order of
two products found by name and by barcode, validate, and confirm the order exists, stock
fell, and the account was charged — all without touching any pre-existing order.

**Acceptance Scenarios**:

1. **Given** a member at the table, **When** staff search a product by name or by barcode and
   add it with a quantity, **Then** the line appears with its current price and the running
   total updates.
2. **Given** an express order with at least one line, **When** staff validate it, **Then** an
   in-store order is recorded as handed over, stock decreases by the quantities sold, and the
   member's account is charged the total.
3. **Given** a product sold by weight, **When** staff enter the weight on the scale, **Then**
   the line is priced from the current price per kilogram.
4. **Given** a product whose current stock is lower than the quantity being sold, **When**
   staff add that quantity, **Then** they are warned, and can still proceed because the shelf
   is what the member is holding.
5. **Given** an archived or otherwise unorderable product, **When** staff search for it,
   **Then** it does not appear among the products they can add.
6. **Given** an express order in progress, **When** staff remove a line or change a quantity
   before validating, **Then** the total updates and nothing has been charged or moved yet.
7. **Given** an express order that has not been validated, **When** staff abandon it, **Then**
   no order, no stock movement, and no charge is recorded.
8. **Given** an express order totalling more than the member's balance, **When** staff
   validate it, **Then** it is refused with the shortfall shown, and validating again works
   once staff have recorded the money the member hands over.

---

### User Story 4 - Member account: balance, history, and putting money in (Priority: P1)

Every member has an account balance. It is the sum of everything ever paid in and everything
ever charged. Members see their own balance and the list of movements behind it. Staff see a
member's balance at the table, and record money the member hands over — cash, a cheque, or a
bank transfer — so the balance covers what they are collecting.

**Why this priority**: A charge against an account nobody can fund is unusable. The ledger
and at least one way to credit it are what make stories 2 and 3 real rather than theoretical.

**Independent Test**: Record a cash payment into a member's account, check the balance rose
by exactly that amount, hand over an order, and check the balance fell by exactly the charged
total and that both movements appear in the history with their dates, amounts, and reasons.

**Acceptance Scenarios**:

1. **Given** a member with recorded movements, **When** they open their account, **Then**
   they see their current balance and every movement behind it, each with a date, an amount,
   and what it was for.
2. **Given** a member hands money to staff at the table, **When** staff record the payment
   and how it was paid — cash, cheque, or bank transfer — **Then** the balance rises by
   exactly that amount and the payment appears in the history with its payment means.
3. **Given** a member whose balance does not cover the handover about to be validated,
   **When** staff validate it, **Then** the handover is refused, the shortfall is shown, and
   nothing is charged or moved until the balance covers the total.
4. **Given** a refused handover and a member who then pays the shortfall, **When** staff
   record that payment and validate again, **Then** the handover goes through.
5. **Given** any member account, **When** the balance is displayed anywhere, **Then** it
   equals the sum of that member's recorded movements, with no separately stored figure that
   could disagree.
6. **Given** a recorded movement, **When** anyone tries to change or delete it, **Then** the
   action is refused — history is never rewritten.
7. **Given** a member who has never had any movement, **When** their balance is displayed,
   **Then** it reads as zero rather than as an error or a blank.

---

### User Story 5 - Work through a distribution from the lists (Priority: P2)

Rather than waiting for members to arrive one by one, staff open the lists: pre-orders to
hand over, in-store orders to hand over, and what is expected today. They see how many people
are still to come and how much is still to go out, and can open any member's screen straight
from the list.

**Why this priority**: It turns a distribution from a queue of surprises into something staff
can prepare and track, but each individual handover already works through story 1 without it.

**Independent Test**: With several members holding outstanding orders of both kinds, open
each list and confirm the right orders appear, that a handed-over order leaves the list, and
that opening a row leads to that member's distribution screen.

**Acceptance Scenarios**:

1. **Given** several members with outstanding pre-orders whose goods arrived, **When** staff
   open the pre-orders list, **Then** every such order is listed with its member and total.
2. **Given** several members with outstanding in-store orders, **When** staff open the
   in-store list, **Then** every such order is listed separately from the pre-orders.
3. **Given** an order was just handed over, **When** staff refresh the list, **Then** that
   order is no longer waiting.
4. **Given** a row in a list, **When** staff open it, **Then** they land on that member's
   distribution screen ready to hand over.
5. **Given** an outstanding order, **When** staff filter the list by the date it is expected,
   **Then** only orders matching that filter are shown.

---

### User Story 6 - Correct a handover that was validated by mistake (Priority: P2)

Staff charged the wrong amount, handed over the wrong product, or validated the wrong
member's order. They record a correction. The original handover stays in the record exactly
as it was, and the correction appears next to it as a separate entry that puts the stock and
the balance back where they should be.

**Why this priority**: Mistakes at a busy table are certain, and a cooperative cannot leave a
member wrongly charged. But the correct path is in place first, and a correction can wait a
few days if it has to.

**Independent Test**: Validate a handover, record a correction for it, and confirm the
member's balance and the product's stock return to the expected values while both the
original entry and the correcting entry remain individually visible.

**Acceptance Scenarios**:

1. **Given** a validated handover, **When** staff record a correction for it, **Then** a new
   entry credits the member and returns the goods to stock, and the original handover and its
   charge remain visible, unchanged.
2. **Given** a corrected handover, **When** anyone reads the member's account history,
   **Then** both the original charge and the correcting credit appear, each with its own date
   and reason, and the balance reflects both.
3. **Given** a handover that was corrected, **When** staff look at the order, **Then** it is
   clear the handover was reversed and the order can be handed over again if that is what
   should happen.
4. **Given** a correction, **When** it is recorded, **Then** who recorded it and why is kept
   with it.

---

### User Story 7 - Restrict the distribution screen to trusted staff (Priority: P2)

A member who helps run distributions gets the `distributor` role. They can use the distribution
screen, build express orders, and record payments. They cannot edit the catalogue, place
supplier orders, receive deliveries, or administer members — those stay with admins.

**Why this priority**: The cooperative needs volunteers at the table without handing each of
them the keys to the whole back office. Admins can already do everything in stories 1 to 6,
so the role is a safety boundary rather than new capability.

**Independent Test**: Give one account the `distributor` role, confirm it can complete a handover
and an express order, and confirm the same account is refused on catalogue, purchasing, and
member-administration actions.

**Acceptance Scenarios**:

1. **Given** an account with the `distributor` role, **When** it opens the distribution screen,
   **Then** access is granted and a handover can be completed.
2. **Given** an account with the `distributor` role, **When** it tries an admin-only action such as
   editing a product or receiving a supplier delivery, **Then** access is refused.
3. **Given** an account with only the `member` role, **When** it tries to open the
   distribution screen, **Then** access is refused.
4. **Given** an admin account, **When** it opens the distribution screen, **Then** access is
   granted — admins keep everything distributors can do.
5. **Given** an admin, **When** they grant or remove the `distributor` role on a member,
   **Then** that member's access changes accordingly.

---

### Edge Cases

- What happens when a member's pre-order was only partly received? The line shows the
  available quantity against the ordered quantity, staff hand over what is there, the member
  is charged for that, and the shortfall is not silently billed.
- What happens when the member is not active (still pending validation, or terminated)? Staff
  are warned before handing over, and the handover of an order belonging to a terminated
  member is refused.
- What happens when a validation fails halfway — the network drops, the page is reloaded and
  resubmitted? Either the whole handover is recorded (order, stock, charge) or none of it is;
  a retry never produces a second charge for the same handover.
- What happens when an express order is validated with every line at zero? It is refused with
  an explanation; an empty sale is not recorded.
- What happens when staff adjust a handover quantity above what was ordered? It is accepted
  and treated as an express addition on the same handover — the member is charged for what
  they actually take — and it is visible as a difference from the original order.
- What happens when the price of a product changed between the order and the distribution? A
  pre-ordered or in-store-ordered line keeps the price recorded when the order was placed; an
  express line uses the price at the table.
- What happens when the product handed over has no stock recorded at all? Stock is allowed to
  go below zero, the shelf being the source of truth, and the negative figure stands as a
  signal that a stock count is needed.
- What happens when the member is short and cannot pay the difference there and then? The
  handover is refused. Staff can hand over fewer lines, or reduce quantities, until the total
  fits the balance, and the rest stays outstanding.
- What happens when a member wants to collect someone else's order? Out of scope for this
  lot: a handover is always recorded against the member who owns the order.
- What happens to an order cancelled by the member before distribution? It never appears on
  the distribution screen.

## Requirements *(mandatory)*

### Functional Requirements

#### Distribution screen

- **FR-001**: The system MUST let staff find a member by name or membership number from the
  distribution screen and open that member's outstanding orders.
- **FR-002**: The system MUST show, for a selected member, every order not yet handed over
  and not cancelled, with each line's product, ordered quantity, available quantity, unit
  price, and line amount, plus the order total.
- **FR-003**: The system MUST distinguish an order whose goods have been received and can be
  handed over from one whose goods have not, and MUST refuse to validate the latter with an
  explanation.
- **FR-004**: The system MUST show the member's current account balance and the amount about
  to be charged on the same screen, before validation, and MUST flag a balance that does not
  cover that amount as soon as it is short rather than only at validation.
- **FR-005**: The system MUST warn staff, before validation, when the member's status is
  anything other than active, and MUST refuse the handover for a terminated member.

#### Handover and adjustment

- **FR-006**: The system MUST let staff set, for each line, the quantity actually handed
  over, including zero, and MUST recalculate the line amount and the order total from it.
- **FR-007**: The system MUST price an adjusted line at the unit price recorded when the
  order was placed, not at the product's current price.
- **FR-008**: The system MUST let staff validate a handover covering some or all of an
  order's lines, leaving any untouched line outstanding for a later distribution.
- **FR-009**: The system MUST, on validation, record the handover, decrease each handed-over
  product's stock by exactly the quantity handed over, and charge the member's account the
  handover total — all three together, or none of them.
- **FR-010**: The system MUST record a handover as a permanent entry that is never edited or
  deleted, keeping what was handed over separate from what was originally ordered.
- **FR-011**: The system MUST refuse to validate a handover for an order already fully handed
  over, and MUST refuse a second concurrent validation of the same order, with an
  explanation in both cases.
- **FR-012**: The system MUST accept a handed-over quantity that differs from the ordered
  quantity, in either direction, without requiring a separate approval step, and MUST make
  the difference visible on the handover record.
- **FR-013**: The system MUST mark an order as fully handed over once every one of its lines
  has been handed over or set to zero.

#### Express order

- **FR-014**: The system MUST let staff build an order at the table for an identified member,
  finding products by name or by barcode among products currently orderable from stock.
- **FR-015**: The system MUST price an express line at the product's current price, including
  the current price per kilogram for a product sold by weight.
- **FR-016**: The system MUST let staff add, change, and remove express lines and see a
  running total before validating, with nothing recorded until validation.
- **FR-017**: The system MUST, on validating an express order, create the order, record it as
  handed over, decrease stock, and charge the member — as one indivisible operation.
- **FR-018**: The system MUST warn staff when an express line's quantity exceeds the
  product's recorded stock, without blocking the sale.
- **FR-019**: The system MUST refuse to validate an express order with no line of non-zero
  quantity.

#### Member account and ledger

- **FR-020**: The system MUST record every movement of member money as a permanent,
  append-only entry carrying its amount, its date, its reason, and what it relates to.
- **FR-021**: The system MUST derive a member's balance as the sum of that member's entries,
  and MUST NOT keep a separately stored balance that could disagree with them.
- **FR-022**: The system MUST NOT allow an existing account entry to be edited or deleted; a
  correction MUST be a new, separately visible entry.
- **FR-023**: The system MUST let a member see their own balance and their own movement
  history, and MUST NOT let them see another member's.
- **FR-024**: The system MUST let staff see a member's balance and movement history from the
  distribution screen.
- **FR-025**: The system MUST show a member with no movements as having a zero balance.
- **FR-026**: The system MUST let staff record money received from a member, crediting that
  member's balance, and MUST record which means it was paid by — cash, cheque, or bank
  transfer — along with who recorded it.
- **FR-027**: The system MUST refuse to validate a handover or an express order whose total
  exceeds the member's available balance, MUST say how much is short, and MUST leave the
  order, the stock, and the balance untouched — so a member balance never goes below zero.
- **FR-028**: The system MUST let staff record a payment and re-validate a handover that was
  refused for an insufficient balance, without rebuilding the handover from scratch.

#### Corrections

- **FR-029**: The system MUST let staff reverse a validated handover by recording a
  correction that credits the member and returns the handed-over quantities to stock, leaving
  the original handover, its charge, and its stock movements untouched.
- **FR-030**: The system MUST keep, with every correction, who recorded it and the reason
  given.
- **FR-031**: The system MUST make an order that had its handover reversed available to be
  handed over again.

#### Distribution lists

- **FR-032**: The system MUST give staff a list of pre-orders waiting to be handed over and a
  separate list of in-store orders waiting to be handed over, each showing the member and the
  amount.
- **FR-033**: The system MUST remove an order from those lists once it is fully handed over.
- **FR-034**: The system MUST let staff filter the waiting lists by date.

#### Roles and access

- **FR-035**: The system MUST add a `distributor` role alongside `member` and `admin`.
- **FR-036**: The system MUST allow `distributor` and `admin` accounts to use the distribution
  screen, express orders, corrections, and recording money received, and MUST refuse those
  actions to a plain `member`.
- **FR-037**: The system MUST refuse a `distributor` account every admin-only action — catalogue
  and supplier editing, purchasing, reception, and member administration.
- **FR-038**: The system MUST let an admin grant and remove the `distributor` role on a member.

### Key Entities *(include if feature involves data)*

- **Handover**: A record of goods physically given to a member at a point in time, against
  one of their orders or created on the spot as an express order. Written once, never edited;
  a mistake is corrected by a reversing handover, not by changing this one. Carries who
  recorded it and when.
- **Handover line**: One product on a handover, with the quantity actually given and the unit
  price applied, compared against the ordered quantity to show any difference.
- **Account entry**: A permanent, append-only movement on a member's account — a charge for a
  handover, money received, or a correction. Carries the amount, the reason, the date, who
  recorded it, and what it relates to; money received also carries the means it was paid by
  (cash, cheque, or bank transfer). A member's balance is always the sum of these, and is
  never allowed to fall below zero.
- **Order** (extended from lot 2): gains the states that say it has been handed over, in whole
  or in part, and the date of that handover.
- **Stock movement** (extended from lot 3): gains negative movements, created by a handover
  and by a correction, alongside the positive movements receptions already create.
- **Role** (extended from lot 1): gains `distributor`, between `member` and `admin`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member's displayed balance equals the sum of their recorded account entries,
  with zero discrepancy, every time it is checked.
- **SC-002**: 100% of charges on a member's account trace back to a specific handover, and
  100% of handovers trace to the member and order they belong to.
- **SC-003**: No order is ever charged twice: repeated or concurrent validation attempts on
  the same order produce exactly one charge.
- **SC-004**: A product's stock level equals the sum of its movements — receptions in,
  handovers out — with zero discrepancy.
- **SC-005**: Staff can find a member and hand over a five-line order, including adjusting two
  quantities, in under 60 seconds.
- **SC-006**: Staff can complete an express sale of three products, from an empty screen to a
  charged account, in under 90 seconds.
- **SC-007**: 100% of validated handovers and account entries remain in the record unchanged;
  every correction appears as an additional, separately visible entry.
- **SC-008**: A failed or interrupted validation never leaves a partial result: either the
  order, the stock, and the balance all moved, or none of them did.
- **SC-009**: A `distributor` account can complete every distribution task and is refused 100% of
  admin-only actions.
- **SC-010**: No member balance ever falls below zero: 100% of handovers and express orders
  that would overdraw an account are refused before anything is charged or moved.
- **SC-011**: Staff can clear a refused handover by recording a payment and validating again
  in under 30 seconds, without re-entering the handover.

## Assumptions

- **A distribution is not a scheduled event in this lot.** There is no distribution session
  to open and close. Staff work continuously from outstanding orders, with a date filter on
  the waiting lists. Scheduling distributions and participation slots belong to lot 6.
- **A handover is always recorded against the member who owns the order.** Collecting on
  behalf of someone else, and proxy or household accounts, are not part of this lot.
- **Goods handed over always pass through stock.** Lot 3 puts everything received onto the
  shelf, so distributing anything — pre-ordered or not — writes a negative stock movement.
  There is no path where goods reach a member without moving stock.
- **Stock is allowed to go negative.** The physical shelf is the source of truth at the table,
  and refusing a sale because the recorded figure is wrong would stop a real transaction. A
  negative figure is a signal to run a stock count, which is a later inventory increment.
- **Barcode support means the product search accepts a scanned or typed barcode.** No
  dedicated scanner hardware integration, no scanner driver, no device pairing.
- **No offline mode.** The distribution screen must be fast and must fail safely — a failed
  validation never half-charges anyone — but it requires a working connection. Offline
  queueing and later synchronisation are a separate piece of work, not a 2-3 week lot.
- **Money is in euros, to the cent, as everywhere else in the app.** Amounts are held exactly
  and never rounded in a way that loses a cent from the ledger.
- **Membership fees are not charged through this ledger in lot 4.** Membership payments
  already exist separately from lot 1 and are not merged into the member account here.
- **Crediting an account in lot 4 is always recorded by a human.** Staff enter the amount and
  the means — cash, cheque, or bank transfer — after the money has actually changed hands or
  landed. The system does not reconcile against a bank feed and does not chase an unpaid
  cheque. Online top-up, payment providers, and invoices are lot 5.
- **A member balance can never go negative.** The cooperative does not lend, so a handover
  that costs more than the balance is refused rather than recorded as a debt. There is no
  overdraft limit and no admin override; the answer at the table is to pay the difference or
  take less.
- **Receipts are shown on screen, not printed or emailed.** After a handover, staff and the
  member can see what was charged; printed tickets and emailed receipts are later work.
- **A correction reverses a whole handover, not one line of it.** Correcting a single line is
  done by reversing the handover and redoing it, which keeps the reversal rule simple.

## Dependencies

- Requires lot 1 members, authentication, and roles (the `distributor` role is added on top of the
  existing `member` / `admin` set).
- Requires lot 2 orders — the pre-orders and in-store orders the distribution screen works
  from, with their checkout price snapshots.
- Requires lot 3 receptions, stock, and the fulfilment marker on order lines, which is how the
  screen knows a pre-order's goods have actually arrived.
- Lot 5 will extend the account ledger introduced here with online top-ups and a payment
  provider; it must not need to change how the ledger itself works.
- Lot 7 accounting exports will read this ledger and these handovers.

## Out of Scope

- Online top-up, payment provider integration, and webhooks (lot 5).
- Participation planning, slots, and hour balances (lot 6).
- Accounting exports and the profit-and-loss account (lot 7).
- Physical inventory counts and manual stock adjustments (a later inventory increment).
- Printed receipts, emailed receipts, and PDF invoices.
- Offline operation of the distribution screen and later synchronisation.
- Collection by proxy, household or shared accounts.
- Deposit products (consigne), supplier credit notes, and paid transport (FRET).
- The surplus view combining grocery stock and supplier stock.
- Messaging members through the platform, including notifying a member that their order is
  ready.
- Everything already out of scope for the whole app: multi-site hosting, the cooperative
  directory, group orders between cooperatives, announcements, services / hour exchange, and
  the BAR module.
