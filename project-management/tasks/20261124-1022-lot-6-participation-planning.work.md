# Lot 6 — Participation planning — work

Created by the Mason at the plan step, 2026-11-24. Spec:
`project-management/tasks/20261124-1022-lot-6-participation-planning.spec.md`.

**Plan:** approved by the Architect, 2026-11-24 10:26. The five rulings are in "Corrections at the reading".

Read before planning: `AGENTS.md` (with "Working with chisel in this repo"), the four files of
`.agents/`, and the reading list of `.agents/project.md` (README, documentation index, general,
backend, frontend and constitution pages, `CONTRIBUTING.md`, `.cursor/rules/`). The closest
models are the wallet and distribution modules and their screens.

## Program Design

### 1. Decisions in one place

- **Two tables, no history.** `slot` and `slotSignup`. A sign-up row is deleted when someone is
  removed. The spec says nothing downstream needs the history in this lot. This is not a ledger,
  so the append-only principle does not apply.
- **A slot is a time range, stored as two instants.** `startsAt` and `endsAt`, both `timestamptz`.
  The API speaks ISO instants. The browser builds them from the date and time the person types, in
  the browser's own time zone, and shows them the same way. The project has no time zone setting
  and the cooperative has one location, so the browser zone is the cooperative's zone. The server
  clock (`new Date()`) is the "cooperative's clock" for the 7-day rule.
- **A slot has a role label and a number of places.** `roleLabel` is free text, 1 to 120 characters
  after trimming. `places` is a whole number from 1 to 200. `endsAt` must be after `startsAt`. A
  slot may cross midnight.
- **Cancelled is a time stamp, not a status column.** `cancelledAt` is null for a live slot. It is
  set once, by one route. Nothing sets it back. See section 5 for why it is final.
- **"Ended" and "started" are never stored.** They are read from the clock each time. A slot that
  has started is not a state in the database.
- **One function decides, and the service only applies it.** The sign-up rules live in
  `participation.util.ts` as pure functions that take the clock as an argument (section 3). The
  service loads the facts, calls the function, and writes.
- **Who may call what.** Admin routes are `@AdminOnly()`. Member routes are `@MemberScoped()`,
  which the guard already lets an admin through. The member routes find the member row of the
  caller. An admin with no member row gets 404 `Member not found` on them (same as the wallet).
- **The last-place check runs under two row locks, always in the same order.** First the member
  row, then the slot row, both `PESSIMISTIC_WRITE`, inside one `em.transactional`. The slot lock is
  what protects the places. The member lock is what protects the no-overlap rule, because two
  sign-ups of one member for two overlapping slots lock different slots and would otherwise both
  pass. One fixed order (member, then slot) rules out a deadlock between two sign-ups. Admin edit
  and cancel lock the slot row only. Removal locks the slot row only.
- **A unique index backs the one-sign-up rule.** `unique (slotId, memberId)`. A violation is turned
  into the refusal `already_signed_up`, like `correctPayment` does for `already_corrected`.
- **Refusals are 409 with a `code`,** through `refusal()` from `common/refusal.ts`. Codes are
  typed lists in the contract file, as the wallet does (`satisfies SignUpRefusal`).
- **Pagination.** The three list routes are paginated with the `@lonestone/nzoth` helpers, order
  by `startsAt` ascending, default page size 50. Slot counts stay small, but the guidelines ask
  for it and the generated client already handles it.
- **A cancelled slot keeps its sign-ups.** Cancelling does not delete sign-up rows. The member who
  holds one still sees the slot in their own list, marked cancelled (the spec's rule). Cancelled
  slots do not count for the overlap rule.
- **The slot's free places.** `signedUpCount` is the number of rows. `freePlaces` is
  `max(places - signedUpCount, 0)`, and is `0` for a cancelled slot ("shows no places").
- **Editing a slot.** An admin may change the role label and the places at any time before the
  slot ends. Places may not drop below the number of sign-ups (`places_below_signups`). The date
  and the times may change only while there are no sign-ups (`slot_has_signups`). Reason: moving a
  booked slot could silently break the no-overlap rule for the members on it and move a
  commitment someone already took. This is a decision the spec left open. See the questions.
- **Cancelling and editing a slot that has ended is refused** (`slot_ended`). Past slots are
  history. Deleting a slot is allowed only with zero sign-ups (`slot_has_signups`), and then at
  any time. The spec: a slot with sign-ups cannot be deleted, it is cancelled.
- **A member may remove their own sign-up from a cancelled slot** at any time before it ends. A
  cancelled slot holds no one to a 7-day notice. This is a small decision the spec left open.

### 2. Files and interfaces, backend

New module `apps/api/src/modules/participation/`, built like `wallet/` and `distribution/`
(backend guidelines, "Module Structure"). The module name `participation` is the spec's. The
constitution's list of planned modules names `planning`. See the questions.

```
participation/
  participation.module.ts
  participation.controller.ts      AdminSlotsController, MemberSlotsController
  participation.service.ts
  participation.mapper.ts
  participation.util.ts            the sign-up rules, pure
  contracts/slot.contract.ts
  entities/slot.entity.ts
  entities/slot-signup.entity.ts
  tests/participation.util.spec.ts
  tests/participation.service.spec.ts      database, two entity managers
  tests/participation.controller.e2e-spec.ts
```

Also changed:

- `apps/api/src/app.module.ts`: import `ParticipationModule`.
- `apps/api/src/seeders/e2e.seeder.ts`: seed a few slots (section 7).
- A migration under `apps/api/src/modules/db/migrations/` (section 4).

**Entities** (camelCase columns, uuid keys with `gen_random_uuid()`, audit fields, as in
`wallet-entry.entity.ts` and `member.entity.ts`):

```ts
@Entity({ tableName: 'slot' })
class Slot {
  id: string
  roleLabel: string // length 120
  startsAt: Date // @Index()
  endsAt: Date
  places: number
  cancelledAt?: Date // nullable
  signups = new Collection<SlotSignup>(this) // OneToMany, mappedBy 'slot'
  createdAt: Date
  updatedAt: Date // onUpdate
}

@Entity({ tableName: 'slotSignup' })
@Unique({ properties: ['slot', 'member'] })
class SlotSignup {
  id: string
  slot: Rel<Slot> // ManyToOne, fieldName 'slotId', @Index()
  member: Rel<Member> // ManyToOne, fieldName 'memberId', @Index()
  createdAt: Date
}
```

The foreign keys are `on delete restrict` on both sides (MikroORM default for a non-nullable
many-to-one is `cascade` on update and no action on delete; the generated SQL is read in the
migration step). Nothing deletes a member. A slot is deleted only with no sign-ups.

**Contract** (`contracts/slot.contract.ts`), every schema with `.meta()` and the inferred type
next to it:

- `slotSchema`: `{ id, roleLabel, startsAt, endsAt, places, signedUpCount, freePlaces,
isCancelled, cancelledAt }`. The member view adds `isSignedUp: boolean`. Two schemas share a base:
  `adminSlotSchema` and `memberSlotSchema`.
- `adminSlotDetailSchema`: `adminSlotSchema` plus `signups: { memberId, memberName,
membershipNumber, signedUpAt }[]`.
- `mySignupSchema`: `{ slotId, roleLabel, startsAt, endsAt, isCancelled, canLeave, leaveDeadline }`.
  `leaveDeadline` is `startsAt` minus 7 days, so the screen can say "until 12 March, 18:00".
  `canLeave` is computed by the same rule function, so the screen never re-derives it.
- `createSlotSchema`: `{ roleLabel, startsAt, endsAt, places }` with the checks above, including
  `endsAt > startsAt` as a `.refine()`. `updateSlotSchema`: the same four, all required (a `PUT`),
  as the other update routes in the repo are `PUT`.
- `signUpMemberSchema`: `{ memberId: uuid }` for the admin sign-up route.
- Lists: `adminSlotListSchema`, `memberSlotListSchema`, `mySignupListSchema` through
  `paginatedSchema`. Query: `includePast` (boolean, default false) on the admin list only, through
  a small query schema next to the pagination one.
- Refusal codes, typed: `SIGN_UP_REFUSALS = ['slot_cancelled', 'slot_ended', 'slot_started',
'slot_full', 'already_signed_up', 'overlaps_another_slot']`, `REMOVAL_REFUSALS = ['slot_ended',
'too_late_to_leave']`, `SLOT_EDIT_REFUSALS = ['slot_ended', 'slot_has_signups',
'places_below_signups']`. Each exposed through `.meta()` so the SPA can branch on it.
- Constants in the contract file: `LEAVE_NOTICE_DAYS = 7`, `MAX_PLACES = 200`.

**Routes**

| Route                                          | Who    | Does                                                | Refused with                                                                   |
| ---------------------------------------------- | ------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET admin/slots`                              | admin  | list, with counts; `includePast`                    | 401, 403                                                                       |
| `GET admin/slots/:slotId`                      | admin  | one slot with its sign-ups                          | 404                                                                            |
| `POST admin/slots`                             | admin  | create                                              | 400 bad body                                                                   |
| `PUT admin/slots/:slotId`                      | admin  | edit                                                | 404; 409 `slot_ended`, `slot_has_signups`, `places_below_signups`              |
| `POST admin/slots/:slotId/cancel`              | admin  | cancel (final)                                      | 404; 409 `slot_ended`; cancelling a cancelled slot is a no-op that answers 200 |
| `DELETE admin/slots/:slotId`                   | admin  | delete                                              | 404; 409 `slot_has_signups`                                                    |
| `POST admin/slots/:slotId/signups`             | admin  | sign up any member                                  | 404; 409 sign-up refusals except `slot_started`                                |
| `DELETE admin/slots/:slotId/signups/:memberId` | admin  | remove any member                                   | 404; 409 `slot_ended`                                                          |
| `GET me/slots`                                 | member | coming, non-cancelled slots, with `isSignedUp`      | 401, 403                                                                       |
| `GET me/signups`                               | member | my coming sign-ups, cancelled ones included, marked | 401, 403                                                                       |
| `POST me/slots/:slotId/signup`                 | member | sign myself up                                      | 404; 409 sign-up refusals                                                      |
| `DELETE me/slots/:slotId/signup`               | member | leave                                               | 404 not signed up or no such slot; 409 `slot_ended`, `too_late_to_leave`       |

Sign-up and removal answers return the updated slot in the caller's view (member or admin), so the
screen can refresh without a second call, like the wallet routes return the wallet. Controllers
use `@TypedController`, `@UseGuards(AuthGuard)` and the typed decorators, mappers turn entities
into contracts and services return entities.

"Coming" is the clock: `GET me/slots` lists slots with `startsAt > now`, not cancelled.
`GET me/signups` lists sign-ups whose slot has `endsAt > now`, so a slot in progress stays visible
to the person on it.

**Service seams** (signatures, in `participation.service.ts`):

```ts
class ParticipationService {
  constructor(em: EntityManager, clock?: () => Date) // clock defaults to () => new Date()
  createSlot(input: SlotInput): Promise<Slot>
  updateSlot(slotId: string, input: SlotInput): Promise<Slot>
  cancelSlot(slotId: string): Promise<Slot>
  deleteSlot(slotId: string): Promise<void>
  listSlotsForAdmin(p: { includePast: boolean } & Pagination): Promise<Page<Slot>>
  getSlotForAdmin(slotId: string): Promise<Slot> // signups populated
  listComingSlots(p: Pagination): Promise<Page<Slot>>
  listMySignups(memberId: string, p: Pagination): Promise<Page<SlotSignup>>
  signUp(p: { slotId: string; memberId: string; actor: 'member' | 'admin' }): Promise<Slot>
  removeSignup(p: { slotId: string; memberId: string; actor: 'member' | 'admin' }): Promise<Slot>
  getMemberForUser(userId: string): Promise<Member>
}
```

The clock is a constructor argument so the service spec can fix it. The controllers use the
default. The database filters ("coming", "ended") use the same `clock()` value, read once per call.

### 3. The sign-up rules (the pure seam)

`participation.util.ts`. No database, no clock of its own:

```ts
export interface SlotFacts {
  startsAt: Date
  endsAt: Date
  places: number
  isCancelled: boolean
  signedUpCount: number
}
export type Actor = 'member' | 'admin'

export const LEAVE_NOTICE_MS = 7 * 24 * 60 * 60 * 1000

export function checkSignUp(p: {
  slot: SlotFacts
  actor: Actor
  now: Date
}): SlotSignUpRefusal | null
export function checkRemoval(p: { slot: SlotFacts; actor: Actor; now: Date }): RemovalRefusal | null
export function canLeave(p: { slot: SlotFacts; now: Date }): boolean // a member's own leave
export function leaveDeadline(slot: { startsAt: Date }): Date
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean
```

`checkSignUp`, in this order, first match wins:

1. cancelled: `slot_cancelled`
2. `now >= endsAt`: `slot_ended`
3. member only, `now >= startsAt`: `slot_started`
4. `signedUpCount >= places`: `slot_full`
5. otherwise `null`

An admin skips the started check (spec: any time before the slot ends) and never skips the full
check (spec: a full slot still refuses). `already_signed_up` and `overlaps_another_slot` need the
database, so the service decides them after `checkSignUp`, in this order: already signed up, then
overlap. A member already on a full slot is told "already signed up", not "full".

`checkRemoval`:

1. `now >= endsAt`: `slot_ended`, for both actors
2. admin: `null`
3. member, slot cancelled: `null`
4. member, `startsAt - now >= LEAVE_NOTICE_MS`: `null`
5. otherwise `too_late_to_leave`

Exactly 7 days before the start is allowed ("7 days or more"). One millisecond less is refused.
`rangesOverlap` is `a.startsAt < b.endsAt && b.startsAt < a.endsAt`: two slots that touch (one ends
at 10:00, the next starts at 10:00) do not overlap.

### 4. Migration

One migration, `pnpm --filter=api db:migrate:create`, then read the SQL first. Expected shape,
written here so the Typist can compare it to what MikroORM emits (do not paste this by hand; the
generated file is the one committed after cleaning):

```sql
create table "slot" ("id" uuid not null default gen_random_uuid(),
  "roleLabel" varchar(120) not null, "startsAt" timestamptz not null, "endsAt" timestamptz not null,
  "places" int not null, "cancelledAt" timestamptz null,
  "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));
create index "slot_startsAt_index" on "slot" ("startsAt");
create table "slotSignup" ("id" uuid not null default gen_random_uuid(),
  "slotId" uuid not null, "memberId" uuid not null, "createdAt" timestamptz not null,
  primary key ("id"));
create index "slotSignup_slotId_index" on "slotSignup" ("slotId");
create index "slotSignup_memberId_index" on "slotSignup" ("memberId");
alter table "slotSignup" add constraint "slotSignup_slotId_memberId_unique" unique ("slotId", "memberId");
alter table "slotSignup" add constraint "slotSignup_slotId_foreign" foreign key ("slotId") references "slot" ("id") on update cascade;
alter table "slotSignup" add constraint "slotSignup_memberId_foreign" foreign key ("memberId") references "member" ("id") on update cascade;
```

Rules from `AGENTS.md`, "Generated migrations":

- MikroORM will also emit a `drop index` and a `create index` line for each of the eight
  `*_search_idx` indexes, because the earlier migrations created them by hand and no entity
  declares them. Remove every one of those lines from `up` and from `down`. Write in the worklog
  that they were removed, and how many. Declaring them on the entities is forbidden (it would
  break `db:fresh:seed` and the test schema).
- Before writing the file, run `pnpm --filter=api exec mikro-orm schema:update --dump` against a
  migrated database to see the difference without writing anything.
- Check that nothing is a `drop` + `add` of an existing column, and that the foreign keys have the
  delete rule listed in section 2.
- No check constraint in SQL. `endsAt > startsAt` and `places >= 1` are checked in the contract and
  in the service. A hand-written check would not be declared on the entity and would show up as a
  difference on the next generated migration.
- The test database is built from the entities, and the E2E database is built by `schema:fresh`.
  Neither replays the migration, so both pick the tables up from the entities with no extra step.
  The E2E reset truncates every table that is not in its short protected list, so the two new
  tables are cleaned with no change to `test-seed.service.ts`.
- The migration is applied to the dev database by hand as a delta if its tracking lags (the
  project note on dev database migrations).

### 5. The one "final" state, and why

A slot with `cancelledAt` set is final. It never returns to live.

Why final: members who signed up have been told, on screen, that the slot is off. Un-cancelling
would silently re-activate bookings nobody confirmed again. An admin who cancelled by mistake
creates a new slot.

Every input that can reach it, and nothing else:

1. `POST admin/slots/:slotId/cancel`, by an admin, on a slot that has not ended.

Nothing else sets `cancelledAt`: not the clock, not a member leaving, not the last member being
removed, not the edit route (the edit contract has no such field), not the seed. Nothing resets it.
The test list has one case per door that must stay closed (section 6, step 3). The Mason and the
reviewers check this list. A second input found in the diff is a defect.

Cancelling a slot that has ended is refused. Cancelling an already cancelled slot changes nothing
and keeps the first time stamp.

"Ended" is not a stored state, so it has no entry path to list: it is the clock passing `endsAt`.

### 6. Steps and tests (vertical, each step ends in a commit)

Order of work. For each step the first failing test is named. The Typist shows that test red, then
makes it green, and writes the red run in the worklog. A step with no red test is reported, not
ticked.

All backend tests follow Arrange-Act-Assert. Test members come from `createMemberData`. Test names
say the rule.

**Step 1. The sign-up rules.** Files: `participation.util.ts`, the refusal lists in the contract
file, `tests/participation.util.spec.ts`. Fixed clock `now = 2026-12-01T09:00:00Z`.

- First failing test: `refuses a member sign-up on a slot that has already started with
slot_started`.
- Then, in this order: lets a member sign up before the start; refuses a cancelled slot first (even
  when also full and started); refuses an ended slot with `slot_ended` for both actors; refuses a
  full slot for a member and for an admin; lets an admin sign up on a slot that has started but not
  ended; leave allowed at exactly 7 days, refused at 7 days minus 1 ms with `too_late_to_leave`;
  admin removal at 1 minute before the start; removal refused after the end for both actors;
  member removal from a cancelled slot allowed inside the 7 days; `rangesOverlap` for inside, same
  range, partial, touching (false), apart (false).

**Step 2. Create and list slots (admin), with the tables.** Files: both entities, the contract
(create, admin list and detail schemas), mapper, service (`createSlot`, `listSlotsForAdmin`,
`getSlotForAdmin`), `AdminSlotsController` (`POST`, `GET` list, `GET` one), module, `app.module.ts`,
the migration (section 4).

- First failing test, e2e: `an admin creates a slot and lists it (201 then 200)`.
- Then: a member gets 403 on every admin slot route; no session gets 401; rejects `endsAt` not
  after `startsAt`, zero places, 201 places, an empty label; the admin list hides ended slots unless
  `includePast=true`, orders by start; 404 on an unknown slot id.
- Migration is read, cleaned and its worklog entry written in this step.

**Step 3. Edit, cancel, delete (admin).** Service `updateSlot`, `cancelSlot`, `deleteSlot`; the
three routes.

- First failing test, e2e: `an admin cannot set places below the sign-ups already there
(places_below_signups)`. It needs two sign-ups, which are inserted straight into the database by
  the test, because the sign-up routes do not exist yet.
- Then: edit changes label and places; edit of date or time with sign-ups refused
  `slot_has_signups`, allowed with none; edit of an ended slot refused; cancel sets `cancelledAt`,
  a second cancel keeps the first time stamp; cancel of an ended slot refused; delete with sign-ups
  refused `slot_has_signups` and the slot is still there; delete with none removes it; a cancelled
  slot with sign-ups still cannot be deleted; a member gets 403 on all three.
- The four closed doors of section 5, one test each: the edit route with a `cancelledAt` in the
  body does not cancel (extra field ignored or refused, whichever the contract does, and
  asserted); a member leaving does not cancel; removing the last sign-up does not cancel; the
  clock passing the end does not set it.

**Step 4. Member sees coming slots and signs up.** Service `listComingSlots`, `signUp` (locks,
rules, unique backstop), `getMemberForUser`; `MemberSlotsController` routes `GET me/slots` and
`POST me/slots/:slotId/signup`.

- First failing test, e2e: `a member signs up for a slot with places left and sees it as taken
by them`.
- Then: refused when full (`slot_full`), started (`slot_started`), ended, cancelled; a second
  sign-up by the same member refused `already_signed_up` and still one row; `freePlaces` drops by
  one and is 0 and `isCancelled` true on a cancelled slot; the member list hides started and
  cancelled slots; an admin with no member row gets 404 on the member routes; a pending member gets
  403; a distributor-and-member can sign up like any member.

**Step 5. Overlap and the last place.** No new route. `signUp` gains the overlap query and the two
locks, in the fixed order (member, then slot).

- First failing test, service spec: `refuses a second slot that overlaps one the member holds
(overlaps_another_slot)`.
- Then: touching slots are allowed; a cancelled slot the member holds does not block; the same slot
  twice reports `already_signed_up` and not an overlap.
- Concurrency tests live in `tests/participation.service.spec.ts`, not in the HTTP spec. The test
  application gives each HTTP test a database pool of one connection (`max: 1` in
  `test-app.helper.ts`), so two HTTP calls run one after the other and would pass even with no lock.
  The wallet specs hit the same limit and use two services on two forked entity managers with
  `Promise.allSettled`. This plan does the same. This is a departure from the spec's testing
  strategy ("including the two parallel sign-ups for the last place" over HTTP), recorded here.
  - `lets one of two members win the last place and refuses the other with slot_full`.
  - `never holds two overlapping slots when one member signs up for both at once`
    (the member lock).
  - The Typist proves each test can fail: it removes the lock for a minute, shows the test red,
    puts the lock back, and writes both runs in the worklog. A lock test that cannot fail is
    worthless.

**Step 6. Leaving, and the admin acting on a member, and my sign-ups.** Service `removeSignup`,
`listMySignups`; routes `DELETE me/slots/:slotId/signup`, `GET me/signups`, `POST
admin/slots/:slotId/signups`, `DELETE admin/slots/:slotId/signups/:memberId`.

- First failing test, e2e: `a member cannot leave less than 7 days before the start and the answer
says too_late_to_leave`.
- Then: leave at 7 days or more works and frees the place; leaving someone else's sign-up is not
  possible (the route takes no member id); leave when not signed up answers 404; admin removes any
  member on a slot starting tomorrow; admin signs up a member on a started slot; admin sign-up on a
  full slot refused `slot_full`; admin actions on an ended slot refused `slot_ended`; admin
  sign-up for an unknown member 404; admin sign-up respects overlap and duplicate; `GET me/signups`
  lists mine only, newest start first is not needed (ascending), includes a cancelled slot marked
  cancelled, carries `canLeave` and `leaveDeadline`, and hides slots that have ended.
- In the e2e spec the clock is real. Slot dates are made relative to now (`Date.now() + n days`),
  and slots in the past are inserted through the entity manager. The "exactly 7 days" edge is
  proven in step 1 with the fixed clock, not over HTTP.

**Step 7. Regenerate the client, member screens, member browser test.**

- First failing test, Playwright: `participation-member.spec.ts` — `a member signs up for a slot,
sees it in their list, and leaves it` (red until the screen exists).
- Run `pnpm generate` against a throwaway API on another port (the project note on OpenAPI
  generation), commit the generated client changes in their own commit.

**Step 8. Admin screens and admin browser test.**

- First failing test, Playwright: `participation-admin.spec.ts` — `an admin creates a slot and the
member sees it`.

**Step 9. Documentation, glossary, index, gates, close.** Section 9.

### 7. Frontend

New folder `apps/web-spa/app/features/participation/` with `components/` and `utils/`, plus
`apps/web-spa/app/features/admin-participation/` with `components/` and `utils/`, split like
`wallet` and `admin-members`. One export per component file, kebab-case names, no hard-coded text
(keys in both `lib/i18n/locales/en/common.locales.en.json` and `.../fr/common.locales.fr.json`),
Lucide icons only, components from `@grocery/ui`, test ids on every control a browser test uses.

TanStack Query options live in `features/participation/utils/participation-queries.ts` and
`features/admin-participation/utils/admin-participation-queries.ts`, the way `wallet-queries.ts`
wraps the generated functions with `unwrap` and exposes `queryOptions` and mutation helpers. The
generated names are not known until the client is regenerated; the Typist reads them then.

Routes in `routes.ts`:

- Member area layout (`member-area-layout.tsx`): `participation` → `participation-page.tsx`.
- Back office layout: `admin/slots` → `slots-list-page.tsx`, `admin/slots/:slotId` →
  `slot-detail-page.tsx`.

Screens and what the person does:

- **Member, `/participation`** (test id `page-participation`). Two blocks.
  - "My coming sign-ups": one row per sign-up with role, date and times, a "Cancelled" badge when
    cancelled, and a "Leave" button. The button is disabled with the sentence "You can leave until
    {{date}}" when `canLeave` is false. Leave asks for a confirmation in a small dialog.
  - "Coming slots": one card per slot with role, date and times, "{{free}} places left" or "Full",
    and a "Sign up" button, disabled when full or when already signed up ("You are signed up").
  - A refusal from the server is shown as a toast with a sentence per code, through
    `refusalMessage`, as the refund dialog does. Both lists refresh after every action.
  - A link "Participation" in `site-header.tsx` for signed-in members, test id
    `site-nav-participation`.
- **Admin, `/admin/slots`** (test id `page-slots-list`). A table of slots with role, date, times,
  `signedUpCount / places`, a cancelled badge, a toggle "Show past slots", a "New slot" button that
  opens the slot form dialog. A nav entry "Participation" in `back-office-layout.tsx`, test id
  `back-office-nav-slots` (it follows the `item.to.split('/').pop()` rule).
- **Admin, `/admin/slots/:slotId`** (test id `page-slot-detail`). The slot, its sign-ups with
  member name and number, "Edit", "Cancel the slot" (confirmation dialog, says it cannot be undone),
  "Delete" (only shown when there are no sign-ups), "Sign up a member" (a member picker using the
  existing admin members query with its search), and a "Remove" button on each sign-up row.
  The date and time fields in the edit form are disabled with an explanation when there are
  sign-ups.
- **Slot form dialog** (create and edit): role label, date, start time, end time, places. A dialog
  with five fields and a cross-field rule (end after start) uses react-hook-form with a Zod
  resolver, as `frontend.mdx` asks for validation across fields. The date and the times are plain
  `type="date"` and `type="time"` inputs; the form builds the two ISO instants in the browser
  zone.

The E2E seeder (`e2e.seeder.ts`) adds slots relative to the seeding moment, so they are always in
the future whenever the suite runs: one slot in 10 days with 2 places ("Run the distribution"),
one in 3 days with 3 places (inside the 7-day window, for the refused-leave case), one in 12 days
with 1 place, left empty. No sign-up is seeded, so each test starts clean after `resetDb`.

### 8. Browser tests

Added, never editing an existing test (the rule in `.agents/project.md`, §F). One exception to say
out loud: `nav-smoke.spec.ts` lists every route and its page test id. The new routes are added to
its list. That is an addition for new routes, not a change to make a test pass.

- `participation-member.spec.ts` (member):
  - signs up for the 10-day slot, sees it under "My coming sign-ups" and the places go down;
  - leaves the 10-day slot, and the place comes back;
  - signs up for the 3-day slot and the Leave button is disabled with the deadline sentence
    (inside the 7 days);
  - a second sign-up for a slot that overlaps is refused with the overlap sentence (the admin
    creates two overlapping slots through the API in the test setup, then the member tries);
  - the full slot shows "Full" and its Sign up button is disabled.
- `participation-admin.spec.ts` (admin):
  - creates a slot through the dialog and it appears in the list;
  - a member sees the new slot, signs up, and the admin detail shows the member;
  - the admin removes that member inside the 7 days (the 3-day slot) where the member could not;
  - the admin cannot delete a slot with sign-ups (no Delete button), cancels it, and the member's
    list shows it marked cancelled with no Sign up button;
  - the admin cannot lower the places below the sign-ups (the form shows the refusal).
- Two roles in one test follow the pattern of `wallet-refund.spec.ts` (a second browser context
  with the member storage state).
- The distributor and pending roles are covered by the API tests, not duplicated in the browser.

### 9. Documentation and close

- New page `apps/documentation/src/content/docs/project/lot-6-participation.mdx`, written like
  `lot-5-wallet.mdx`: plain words, what the lot gives, the rules (places, 7 days, overlap, cancel
  not delete, admin override), "Not in lot 6", "Where the code is". The front matter description
  is quoted if it holds a colon, and `astro build` is run (documentation build) because the page is
  new.
- `apps/documentation/src/content/docs/project/glossary.mdx`: a "Participation" section with the
  words slot, sign-up, places, leave deadline, cancelled slot.
- `apps/documentation/src/content/docs/project/architecture-plan.mdx`: lot 6 marked as built the
  same way the earlier lots are.
- `apps/documentation/src/content/docs/project/lot-4-distribution.mdx`, "Not in lot 4": a pointer
  to the lot 6 page.
- `pnpm --filter @grocery/documentation generate:index` for `INDEX.md`.
- If the human rules that the module name stays `participation`, a note in the constitution's
  list of planned modules (a PATCH-level wording change, a version bump) so the two documents
  agree. Not done without that ruling.
- Gates, in this order, the long ones in the background with a full log file:
  `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then `docker ps` for ports 5434, 1093 and
  1043, then `pnpm e2e`. Never `pnpm fmt` repo-wide: format with `oxfmt` per folder and check with
  `pnpm fmt:check`. A flaky wallet or distribution test is rerun once and said so in the report.
- Commits: one per green step, explicit paths, scope `api`, `frontend` or `tooling`/`docs` as in
  `commitlint.config.ts`, gitmoji after the colon, no `Co-Authored-By`, no push.

### 10. Edge cases handled, in one list

- Two members, last place: one wins, one gets `slot_full`.
- One member, two overlapping slots at the same moment: one wins, one gets
  `overlaps_another_slot`.
- Same member twice on the same slot at the same moment: one row, the other gets
  `already_signed_up` (unique index).
- An admin edits the places down while a member signs up: both lock the slot row, so the edit sees
  the new sign-up count or the sign-up sees the new places. Either way the places never end below
  the sign-ups.
- A member is suspended or has left: member routes already refuse a member who is not active (403
  from the guard). An admin may still sign up or remove such a member (the admin route checks that
  the member exists, nothing more). Removal of a past member's sign-up by an admin is possible.
- A slot across midnight: allowed. A slot of zero length: refused.
- The browser and the server disagree on the time zone: the API only ever sees instants, so they
  cannot disagree.

## Corrections at the reading

Signed: Architect, 2026-11-24 10:26.

- **Module name.** Keep `participation`, as the spec says. Do the small wording change in the
  constitution's list of planned modules, so both documents agree.
- **Editing a booked slot.** Keep the plan: label and places may change; date and times only
  while there are no sign-ups.
- **Leaving a cancelled slot.** Keep the plan: allowed any time before it ends, no 7-day notice.
- **Time zone.** Keep the plan: the browser zone is the cooperative's zone. Write this limit in
  the lot 6 documentation page.
- **Admin without a member row.** Keep the plan: 404 on the member routes. Admins use the admin
  screens.
- **Lock tests in the service spec instead of over HTTP.** Accepted. It departs from the spec's
  testing line only in how the proof is made, not in what is proven.

## Worklog

### 2026-11-24 — Typist, backend steps 1 to 6

Test command used: `NODE_ENV=test pnpm exec vitest run --config=vitest.config.ts <file pattern>` in `apps/api`
(`pnpm test -- <path>` ignores the filter and runs the whole suite).

**Step 1.** First failing test `refuses a member sign-up on a slot that has already started with slot_started`.
Red seen first with a stub that returns null: `1 failed`, `AssertionError: expected null to be 'slot_started'`.
(Before the stub, the file did not even load: `Cannot find module '../participation.util'`.)
Green after the real rules: 20 tests pass in `participation.util.spec.ts`.

**Step 2.** First failing test (e2e) `an admin creates a slot and lists it (201 then 200)`. Red seen first, with an
empty `ParticipationModule`: `AssertionError: expected 404 to be 201`. Green after the entities, contract, mapper,
service, controller and module: 10 tests pass in `participation.controller.e2e-spec.ts` (create and list, 403 and 401,
four bad bodies, 200 places and midnight, `includePast` and order, detail and 404).

Migration `Migration20261124093029.ts`, made against a throwaway Postgres (container `typist-lot6-pg`, port 5499, stopped
and removed afterwards; port 5111 belongs to another project and was not touched). I ran `db:migrate:up` first, then
`schema:update --dump`, then `db:migrate:create`. **Stray lines removed: 16** (8 `drop index` lines in `up`, 8
`create index` lines in `down`, one per `*_search_idx` index). The dump also wanted to drop the `normalize_search`
function; the generated file did not carry that line, so nothing more to remove. Compared with plan section 4: the
tables, the three indexes, the unique pair and the two foreign keys are the same as expected. One difference: the
foreign keys have no `on update cascade` (the plan's sketch had it). MikroORM emits a plain `references ... ("id")`,
which is also what the earlier migrations do (for example `walletEntry_memberId_foreign`), so I kept the generated
form. Delete is "no action", so deleting a member or a slot that has sign-ups fails. The migration also applied, rolled
back and applied again cleanly, and after it the only difference left in `schema:update --dump` is the eight stray
search indexes and the function. Running `migration:create` and `migration:up` rewrote `.snapshot-grocery.json`
(about 1300 lines, dropping the search indexes). I restored it with `git checkout`, since lot 5 did not commit it
either. Running `oxfmt` on the whole migrations folder also touched an older migration; I restored that one too.

## Implementation Checkboxes

- [x] Step 1. The sign-up rules (util, refusal lists, unit spec).
- [x] Step 2. Tables, migration, admin create and list.
- [ ] Step 3. Admin edit, cancel, delete.
- [ ] Step 4. Member lists coming slots and signs up.
- [ ] Step 5. Overlap rule and the two locks, with the concurrency tests.
- [ ] Step 6. Leave, admin sign-up and removal, my sign-ups.
- [ ] Step 7. Regenerated client, member screens, member browser test.
- [ ] Step 8. Admin screens, admin browser test, nav smoke routes, E2E seed slots.
- [ ] Step 9. Documentation page, glossary, index, gates, close.

## Notes & Snippets

- Models read: `wallet.service.ts` (row lock, unique-index backstop, `refusal()`), `wallet.controller.ts`
  (two controllers, one per audience, `@AdminOnly` / `@StaffOnly` / `@MemberScoped`),
  `purchase-guard.ts` (a pure rule next to a thin injectable), `wallet.service.spec.ts` (two entity
  managers with `Promise.allSettled`), `refund-dialog.tsx` and `wallet-queries.ts` on the frontend.
- The auth guard reads roles with `getAllAndOverride` (handler, then class). `@MemberScoped()` lets
  an admin through without a member row.
- The test application's pool is one connection (`test-app.helper.ts`). HTTP tests cannot prove a
  lock.

## Diff-Review Findings

(none yet)
