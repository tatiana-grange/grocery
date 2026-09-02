# Feature Specification: Foundation — Members, Access Roles, and Catalogue

**Feature Branch**: `feat/foundation`
**Created**: 2026-09-01
**Status**: Draft
**Input**: User description: "lot 1"

## Context

This is delivery lot 1 of the participative grocery app (the "Foundation" lot in the
architecture plan). It establishes the three things every later lot builds on:

1. **Members** — how someone joins the cooperative and is recognised by the system.
2. **Access roles** — the difference between a plain member and an administrator. An
   administrator is a member with extra powers: they can do everything a member can, plus
   run the back office.
3. **Catalogue** — the list of suppliers and the products the cooperative offers, with
   prices, categories, and units (including products sold by weight).

Lot 1 deliberately stops before the public shop (lot 2), purchasing and stock (lot 3),
distribution (lot 4), and the online wallet (lot 5). Money movement, stock levels, and
customer-facing browsing are out of scope here.

A "grocer" role for people staffing a distribution is **not** part of lot 1. Suppliers do
not get accounts at all in lot 1 — an administrator records them as catalogue data. Both
are added later, when distribution (lot 4) needs them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A person joins the cooperative (Priority: P1)

A prospective member fills in a short sign-up form with their name, a password, and
**either an email address or a phone number** as their identifier. They receive a
confirmation message on whichever one they gave — a link by email, or a one-time code by
text — and confirm it. Their account is then "pending". An administrator sees the pending
request, checks it, and validates it. The person is notified and can now sign in as an
active member, using the identifier they registered with.

**Why this priority**: Without members there is nobody to sell to and no balances to hold.
Every other lot assumes an active member exists. This story alone is a usable product: the
cooperative can register and validate its membership.

**Independent Test**: Register a new person end to end (once with an email, once with a
phone number), confirm the identifier, validate from the admin side, and sign in as that
member. No catalogue or role management is needed to test it.

**Acceptance Scenarios**:

1. **Given** no account exists for an identifier, **When** a person completes the sign-up
   form with an email address, **Then** an unconfirmed, pending account is created and a
   confirmation link is sent by email.
2. **Given** no account exists for an identifier, **When** a person completes the sign-up
   form with a phone number, **Then** an unconfirmed, pending account is created and a
   one-time confirmation code is sent by text.
3. **Given** a pending unconfirmed account, **When** the person acts on the confirmation
   link or enters the code, **Then** the identifier is marked confirmed and the account
   appears in the administrator's list of members awaiting validation.
4. **Given** a confirmed pending account, **When** an administrator validates it, **Then**
   the member becomes active, is notified, and can sign in.
5. **Given** a confirmed pending account, **When** an administrator rejects it with a
   reason, **Then** the person is notified and cannot sign in.
6. **Given** an identifier that already has an account, **When** someone tries to sign up
   with that same email or phone number, **Then** sign-up is refused with a clear message
   and no second account is created.

---

### User Story 2 - An administrator builds the catalogue (Priority: P2)

An administrator creates suppliers (name, contact details, type such as producer or
wholesaler). For each supplier they add products: name, description, category, one or more
photos, informational labels (organic, local, vegetarian/vegan), and a price. A product is
sold either per unit or by weight (priced per kilo). Products and suppliers that are no
longer offered are archived rather than deleted, so past references stay intact.

**Why this priority**: The catalogue is the second foundation. Lots 2 to 4 (shop, ordering,
purchasing, distribution) all read from it. It can be built in parallel with member
management and demonstrated on its own.

**Independent Test**: Create a supplier, add a per-unit product and a by-weight product to
it, set prices, archive one product, and confirm the archived product no longer appears in
active lists but is still retrievable.

**Acceptance Scenarios**:

1. **Given** the administrator is signed in, **When** they create a supplier with a name
   and contact details, **Then** the supplier is saved and available to attach products to.
2. **Given** a supplier exists, **When** the administrator adds a product with a name,
   category, unit type, and price, **Then** the product is saved and listed under that
   supplier.
3. **Given** a product is sold by weight, **When** the administrator sets its price,
   **Then** the price is expressed per kilogram and the product is flagged as weight-based.
4. **Given** a product's price changes, **When** the administrator sets a new price, **Then**
   the previous price is kept as history with its effective dates.
5. **Given** an active product, **When** the administrator archives it, **Then** it
   disappears from active catalogue lists but remains visible in historical and detail
   views.
6. **Given** a supplier with active products, **When** the administrator archives the
   supplier, **Then** the system warns about the active products and archives them together
   or blocks the action until they are handled.

---

### User Story 3 - A member manages their own account (Priority: P3)

A signed-in member views and edits their personal details (name, postal address, phone),
changes their password, and sees their current membership status and membership-fee state.
They also have a personal QR code that identifies them (used later at distribution).

**Why this priority**: Members must be able to keep their own data current without
contacting an administrator, and the QR code is needed before distribution (lot 4). It
depends on User Story 1 but adds clear standalone value.

**Independent Test**: Sign in as an active member, edit personal details, change the
password, sign out, and sign back in with the new password. Confirm the QR code is shown.

**Acceptance Scenarios**:

1. **Given** a signed-in member, **When** they edit their personal details and save,
   **Then** the changes are stored and shown on reload.
2. **Given** a signed-in member, **When** they change their password with the correct
   current password, **Then** the new password works on the next sign-in and the old one
   does not.
3. **Given** a member who forgot their password, **When** they request a reset and act on
   the link sent by email or the code sent by text, **Then** they can set a new password.
4. **Given** a signed-in member, **When** they open their account page, **Then** they see
   their membership status and whether the membership fee is recorded as paid.
5. **Given** a signed-in member, **When** they open their account page, **Then** a personal
   QR code identifying them is displayed.

---

### User Story 4 - An administrator manages the admin role (Priority: P3)

An administrator grants or removes the "admin" role for a member. An admin can do
everything a plain member can, plus reach the full back office. A plain member cannot reach
any back-office screen. The person keeps one account either way.

**Why this priority**: The cooperative needs to designate who can administer the system,
and later lots gate their screens on this role, so it must exist now. Lower than catalogue
because only a few people need it on day one.

**Independent Test**: As an admin, grant the admin role to a plain member and confirm they
gain back-office access; remove it and confirm access is withdrawn. Confirm a plain member
cannot reach any back-office screen.

**Acceptance Scenarios**:

1. **Given** an active plain member, **When** an administrator grants them the admin role,
   **Then** the member gains back-office access immediately or on their next sign-in, while
   keeping every plain-member capability.
2. **Given** a member with the admin role, **When** an administrator removes it, **Then**
   back-office access is withdrawn but the person stays an active member.
3. **Given** a plain member, **When** they try to open a back-office screen, **Then** access
   is denied.
4. **Given** the system has at least one administrator, **When** an administrator tries to
   remove the last remaining admin role, **Then** the action is blocked.

---

### User Story 5 - Ending a membership (Priority: P4)

A member ends their own membership from their account, or an administrator ends it on their
behalf (for example, non-payment or a move away). The account becomes "terminated": the
person can no longer act as a member, but their history is kept.

**Why this priority**: Needed for a correct member lifecycle and required by cooperative
rules, but not on the critical path for the first usable version.

**Independent Test**: Terminate a member (self and admin paths), confirm they can no longer
sign in as an active member, and confirm their record and history remain retrievable.

**Acceptance Scenarios**:

1. **Given** an active member, **When** they confirm self-termination, **Then** their status
   becomes terminated and active member actions are refused.
2. **Given** an active member, **When** an administrator terminates them with a reason,
   **Then** the member is notified and their status becomes terminated.
3. **Given** a terminated member, **When** an administrator reactivates them, **Then** they
   return to active status with their previous personal data intact.

---

### Edge Cases

- A confirmation link or one-time code, or a password-reset link, is expired or already
  used — the person can request a fresh one.
- A person signs up but never confirms their email or phone number — the pending
  unconfirmed account is clearly separated from confirmed pending accounts and can be
  cleaned up.
- A person tries to add a second identifier of the same kind, or an identifier already used
  by another account — refused with a clear message.
- A category still has products attached when someone tries to remove it — removal is
  blocked or the products are reassigned first.
- A product is switched between per-unit and by-weight after it already has a price —
  the price unit is re-confirmed.
- Two administrators edit the same product or member at the same time — the second save is
  warned about the stale data rather than silently overwriting.
- A rejected or terminated person signs up again with the same email or phone number —
  handled as a new request, not a silent duplicate.
- Membership fee is only partly recorded (variable fee, instalments) — status reflects
  "partly paid" rather than a yes/no only.

## Requirements *(mandatory)*

### Functional Requirements

#### Membership and sign-up

- **FR-001**: The system MUST let a prospective member self-register with a name, a
  password, and at least one identifier that is either an email address or a phone number.
- **FR-002**: The system MUST send a confirmation on sign-up to the identifier that was
  given — a link by email, a one-time code by text — and MUST NOT treat that identifier as
  confirmed until the recipient acts on it.
- **FR-003**: The system MUST refuse a second account for an email address or phone number
  that already belongs to an account, with a clear message.
- **FR-004**: The system MUST place every new member in a "pending" state and MUST require an
  administrator decision (validate or reject) before the member becomes active.
- **FR-005**: The system MUST notify the person of the outcome of the administrator's
  decision.
- **FR-006**: The system MUST let an administrator open and close membership intake (a
  switch that controls whether self-registration is currently accepted).
- **FR-007**: The system MUST record each member's status over time (pending, active,
  rejected, terminated) so the current status is always known.

#### Authentication and account

- **FR-008**: The system MUST authenticate members by their registered identifier (email or
  phone number) and password.
- **FR-009**: The system MUST let a member reset a forgotten password through a link sent to
  their email or a one-time code sent to their phone number.
- **FR-010**: The system MUST let a signed-in member change their password after confirming
  the current one.
- **FR-011**: The system MUST let a signed-in member view and edit their own personal
  details (name, postal address, phone).
- **FR-012**: The system MUST show each active member a personal identifying QR code.
- **FR-013**: The system MUST prevent an account with no confirmed identifier, or one that
  is not active, from signing in as a member.

#### Roles and access

- **FR-014**: The system MUST support two access levels in lot 1: member and admin. An
  admin has every member capability plus back-office access. (A "grocer" role is added in a
  later lot.)
- **FR-015**: The system MUST let an administrator grant and remove the admin role for any
  member.
- **FR-016**: The system MUST keep one account per person whether or not they are an admin.
- **FR-017**: The system MUST deny back-office actions to anyone who is not an admin.
- **FR-018**: The system MUST prevent removal of the admin role from the last remaining
  administrator.

#### Membership fee

- **FR-019**: The system MUST hold a configurable default membership-fee amount and MUST
  allow a per-member override (variable fee).
- **FR-020**: The system MUST let an administrator record membership-fee payments against a
  member and MUST show a fee state of unpaid, partly paid, or paid.
- **FR-021**: The system MUST show each member their own membership-fee state.

#### Suppliers

- **FR-022**: The system MUST let an administrator create and edit suppliers with a name,
  contact details, and a type (for example producer or wholesaler).
- **FR-023**: The system MUST let an administrator archive a supplier instead of deleting
  it, keeping it out of active lists while preserving its record.
- **FR-024**: The system MUST handle a supplier's active products when the supplier is
  archived (archive them together or require them to be handled first).

#### Products and categories

- **FR-025**: The system MUST let an administrator organise products into categories.
- **FR-026**: The system MUST prevent losing products when a category is removed (block the
  removal or require reassignment).
- **FR-027**: The system MUST let an administrator create and edit products with at least a
  name, description, category, supplier, one or more photos, and informational labels
  (organic, local, vegetarian/vegan).
- **FR-028**: The system MUST let a product be sold either per unit or by weight, and MUST
  record which one applies.
- **FR-029**: The system MUST express a by-weight product's price per kilogram.
- **FR-030**: The system MUST keep a product's price history with effective dates when the
  price changes, rather than overwriting the old price.
- **FR-031**: The system MUST let an administrator archive a product instead of deleting it,
  keeping it out of active catalogue lists while keeping it retrievable in detail and
  historical views.
- **FR-032**: The system MUST exclude archived suppliers and products from the lists used to
  build orders and other active workflows.

#### Auditing

- **FR-033**: The system MUST record who changed a member's status, who recorded a
  membership-fee payment, and who set a product price, and when. (Full created-by /
  updated-by auditing on every catalogue and member record is deferred to a later lot; the
  lot-1 audit covers the money- and lifecycle-sensitive changes.)
- **FR-034**: The system MUST warn an editor when they are about to save over a record that
  changed since they loaded it.

### Key Entities *(include if feature involves data)*

- **Member**: A person recognised by the cooperative. Holds personal details (name, postal
  address, phone), current status (pending, active, rejected, terminated), status history,
  and a membership number used for the QR code.
- **Identifier**: An email address or phone number that belongs to an account, each either
  confirmed or not. An account has at least one and is reached (for sign-in, confirmation,
  reset) through it.
- **Admin role**: A flag on an account that grants back-office access on top of every
  member capability. An account without it is a plain member.
- **Membership fee record**: The expected fee for a member (default or overridden) and the
  payments recorded against it, producing a fee state.
- **Supplier**: A source of products. Name, contact details, type (producer, wholesaler),
  archived flag.
- **Category**: A grouping for products in the catalogue.
- **Product**: An item the cooperative offers. Name, description, category, supplier,
  photos, informational labels, sale mode (per unit or by weight), archived flag.
- **Product price**: A price for a product effective over a date range, kept as history.
  Carries the unit it is expressed in (per unit or per kilogram).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A prospective member can complete the sign-up form and confirm their
  identifier (email link or phone code) in under 3 minutes without assistance.
- **SC-002**: An administrator can review and validate a pending member in under 1 minute,
  and the validated member can sign in immediately afterward.
- **SC-003**: An administrator can create a new supplier and add a sellable product (with
  category, sale mode, and price) in under 5 minutes on their first attempt without help.
- **SC-004**: 100% of products can be configured for sale either per unit or by weight.
- **SC-005**: 100% of attempts by a plain member to reach a back-office screen are denied.
- **SC-006**: Archived suppliers and products appear in 0% of the lists used to build orders
  and other active workflows, while remaining 100% retrievable in detail and historical
  views.
- **SC-007**: Every past price of a product remains retrievable after the price has changed
  at least three times.
- **SC-008**: A member can update their personal details and change their password with no
  administrator involvement, verified by signing in with the new password.
- **SC-009**: The cooperative can register its full current membership (order of 100–300
  people) and have every account resolve to exactly one person with a known status.
- **SC-010**: Attempting to remove the last administrator fails 100% of the time.

## Assumptions

- **Online payments are out of scope.** Membership-fee payment online and account top-ups
  belong to lot 5. In lot 1 an administrator records fee payments manually; the system only
  tracks the fee state.
- **The public shop is out of scope.** Customer-facing browsing, cart, and ordering belong
  to lot 2. Catalogue management in lot 1 is back-office only.
- **Stock is out of scope.** Quantities on hand, cost price, and stock movements belong to
  lot 3. Products in lot 1 carry catalogue data only (identity, category, supplier, labels,
  price, sale mode).
- **Members self-register and are then validated by an administrator**, matching the
  "opening of memberships" concept from the feature inventory. Administrators may also
  create a member directly.
- **Sign-in is by identifier plus password**, where the identifier is an email address or a
  phone number. Email is confirmed by link, phone by one-time code. No single sign-on or
  social login in lot 1.
- **Sending text messages needs an external provider.** In lot 1 the phone one-time code is
  delivered through whatever SMS channel is configured; for local development it is shown
  the same way development emails are (a local inbox / log), and choosing and hardening a
  production SMS provider is a separate infrastructure task.
- **Roles in lot 1 are member and admin only.** The grocer role and supplier accounts come
  with distribution (lot 4). Multi-site organisation roles are never used.
- **Informational labels and scores**: the organic / local / vegetarian-vegan labels are in
  scope. Nutri-score, Nova-score, Eco-score, and member ratings are captured as optional
  fields only if cheap; member ratings depend on the shop (lot 2) and are otherwise
  deferred.
- **Participation planning is out of scope** (lot 6), including the age-70 participation
  exemption and hour balances.
- **Platform messaging between the grocery and members is out of scope** for lot 1.
- **Variable membership fee** is modelled as a per-member override of the default amount,
  plus the ability to record partial payment.
- **A "member" record and a "user account" are the same thing** in this app — one person,
  one login, one profile.

## Dependencies

- Requires a working transactional email channel for confirmation, password reset, and
  decision notifications.
- Requires a text-message (SMS) channel for phone-number confirmation and phone-based
  password reset.
- Later lots (shop, orders, purchasing, distribution) depend on the supplier, category,
  product, and price entities defined here, and on the member and role model.
- The personal QR code defined here is consumed by the distribution screen in lot 4.

## Out of Scope

- Public shop and product browsing, cart, pre-order and in-store order (lot 2).
- Supplier ordering, reception, stock levels, weighted average cost price (lot 3).
- Distribution screen, express order, wallet debit, the grocer role, and supplier login
  accounts / supplier portal (lot 4).
- Online membership-fee payment, account top-ups, payment provider integration (lot 5).
- Participation slots, sign-ups, hour balances, age-70 exemption (lot 6).
- Accounting exports and profit-and-loss (lot 7).
- Multi-site hosting, cooperative directory, group orders between cooperatives, the
  announcements module, the services / hour-exchange module, and the BAR module (permanently
  out of scope for this app).
- Deposit products (consigne), supplier credit notes, and FRET transport — designed for
  later, not built in lot 1.
