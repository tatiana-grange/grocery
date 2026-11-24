# Lot 6 — Participation planning

**Status:** in-progress

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

Members of the grocery give some of their time to run it. Today nothing in the app lets
admins offer time slots or lets members choose one. Lot 6 adds that planning. It is the
sixth delivery lot of `apps/documentation/src/content/docs/project/architecture-plan.mdx`
(section "Delivery lots"). The feature list in
`apps/documentation/src/content/docs/project/monepi-features.mdx` says members sign up for
slots, manage their own sign-ups, and may change them up to one week before.

Lot 4 did not plan distributions as events, so a slot here is its own thing and is linked to
no distribution.

## Scope

**Included:**

- An admin creates, edits and cancels a **slot**: a date, a start and end time, a role label
  (for example "run the distribution"), and a number of places.
- A member sees the coming slots and signs up for one, as long as places are left.
- A member removes their own sign-up up to 7 days before the slot starts.
- An admin signs up or removes any member, at any time.
- A member sees their own coming sign-ups.

**Not Included:**

- Hour balances, hour debt per period, and the age-70 exemption.
- Recording who showed up or who did not.
- E-mails or any other notification.
- Repeating slots (an admin creates each slot by hand).
- Linking a slot to a distribution, a supplier collection, or any other event.
- Transferring hours between members.

## Acceptance Criteria

- [ ] **admin-manages-slots** — an admin can create, edit and cancel a slot; a member cannot.
- [ ] **member-signs-up-while-places-left** — a member signs up to a coming slot; the sign-up
      is refused when the slot is full, already started, or cancelled.
- [ ] **no-double-booking-of-places** — two sign-ups arriving at the same moment for the last
      place never both succeed.
- [ ] **one-sign-up-per-member-per-slot** — signing up twice for the same slot is refused.
- [ ] **no-overlapping-slots-for-a-member** — a member cannot hold two slots whose times
      overlap.
- [ ] **member-leaves-until-seven-days-before** — a member removes their own sign-up only
      when the slot starts in 7 days or more; after that the refusal says why.
- [ ] **admin-overrides-the-deadline** — an admin can sign up or remove any member at any
      time before the slot ends, a full slot still refuses a new sign-up.
- [ ] **cancel-not-delete-when-booked** — a slot with sign-ups cannot be deleted; it can only
      be cancelled, and a cancelled slot shows no places and accepts no sign-up.
- [ ] **places-cannot-drop-below-sign-ups** — an admin cannot set the number of places lower
      than the sign-ups already there.
- [ ] **screens-for-both-roles** — the member sees slots and their own sign-ups in the SPA;
      the admin manages slots and sign-ups in the SPA. Covered by the browser suite.
- [ ] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and
      `pnpm e2e` all pass.

## Seams

- **Slot routes (admin)** — create, edit, cancel, list with sign-ups, sign up or remove a
  member. Observable over HTTP.
- **Slot routes (member)** — list coming slots with free places, sign up, leave, list my
  sign-ups. Observable over HTTP.
- **Sign-up rules** — one function decides whether a sign-up or a removal is allowed from
  the slot, the member, the role and the clock. Observable: a table of cases with a fixed
  clock.

## Architecture

**System design:** a new `participation` module in the API, built like the other modules
(`apps/documentation/src/content/docs/references/backend.mdx`), with two tables: slots and
sign-ups. Sign-ups are deleted when removed (nothing downstream needs their history in this
lot). The last-place check runs under a row lock on the slot. The typed chain stays: Zod
schemas, OpenAPI, generated client, then the SPA. Every change to the database is a
migration. A "final" state is not introduced: a cancelled slot is the only terminal state,
and it is reached only by an admin cancelling it.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

- Decided with the human on 2026-11-24: planning only, no hour balance; a slot is a time
  range with a role label and a number of places.
- The 7-day rule is measured from the slot's start time, with the cooperative's clock.
- Defaults the human accepted: members sign themselves up and leave alone; admins can do both
  for anyone; no overlap for one member; no attendance; no e-mails.
- The member sees only coming, non-cancelled slots in the list; a slot they hold stays
  visible in their own list even if cancelled, marked as cancelled.

## Testing Strategy

- Sign-up rules with a table of cases and a fixed clock, test first.
- Slot and sign-up routes over HTTP against the test database, including the two parallel
  sign-ups for the last place.
- Browser tests for the member journey (sign up, leave) and the admin journey (create, cancel).

## Slices & Dependencies

- **Slices:** none. One pass, one branch: `feat/participation-planning`.

## Deliverables

- [ ] The `participation` API module, its migration and tests.
- [ ] The member and admin screens, and the regenerated client.
- [ ] A documentation page for lot 6 and the updated documentation index.

## References

- `apps/documentation/src/content/docs/project/architecture-plan.mdx`, "Delivery lots" —
  names lot 6.
- `apps/documentation/src/content/docs/project/lot-4-distribution.mdx`, "Not in lot 4" —
  says participation planning was left to lot 6.
- `project-management/archive/20261123-1014-lot-5-wallet.spec.md` — the lot 5 spec, the
  closest example of form and rigour.

## Notes

## Retrospective
