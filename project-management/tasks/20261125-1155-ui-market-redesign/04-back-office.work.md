# 04 — Back office — work

Created by the Mason at the plan step, 2026-11-25. Spec:
`project-management/tasks/20261125-1155-ui-market-redesign/04-back-office.spec.md`.
The parent spec, with the owner's decisions, is
`project-management/tasks/20261125-1155-ui-market-redesign.spec.md`. The theme tokens, the
`AwningBand` component and the browser test `market-theme.spec.ts` come from slice 01; the
overflow and small-text helpers of `member-phone.spec.ts` come from slice 02. Their work documents
sit in this folder.

**Plan:** approved by the Architect, 2026-11-25, with the rulings in Notes & Snippets.

## Program Design

### What changes, in one paragraph

The back office gets the reference look from the members artboard. The sidebar turns cream with a
2 px right border, the awning band on top, "Grocery" in Lora with a subtitle, 18 px links with an
icon each and the current one filled in sage, and a straw "Ouvrir la distribution" button at the
bottom. Every back office page opens with one shared page head: a Lora title at 52 px, its
explanation at 20 px, and small figure cards where the page already shows a number. Every table
sits in one shared frame: 2 px border, 16 px corners, a tinted heading row at 16 px bold, rows that
scroll sideways inside the frame. Statuses are word badges in four tones (attention, positive,
negative, neutral). Row actions are 44 px outline buttons with a word, and the main one of a row
is sage. `ListPagination` gains three optional label props; the back office passes translated
words. One new theme tint carries the "waiting for review" rows. Routes, guards, API calls,
journeys and existing `data-testid` values do not move. A new browser test, written first and
grown step by step, checks the desktop at 1440 and 1194 px in both modes. No existing test is
edited.

### Files

| File                                                                                      | Change                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/styles/globals.css`                                                      | New token `--straw-tint` in `:root` and `.dark`, mapped to `--color-straw-tint` in `@theme inline`.                                   |
| `packages/ui/src/styles/theme.spec.ts`                                                    | Expects the new token in both modes; adds its contrast pairs, and the missing `sidebar-primary-foreground` on `sidebar-primary` pair. |
| `packages/ui/src/components/app/list-pagination.tsx`                                      | Three optional props, additive (see below).                                                                                           |
| `packages/ui/src/components/app/list-pagination.spec.tsx`                                 | New unit test, server-rendered like `awning-band.spec.tsx`.                                                                           |
| `apps/web-spa-e2e/tests/back-office-desktop.spec.ts`                                      | New browser test, grown step by step.                                                                                                 |
| `apps/web-spa/app/features/common/components/back-office-layout.tsx`                      | The sidebar and the header bar (see below).                                                                                           |
| `apps/web-spa/app/features/common/components/back-office-page-head.tsx`                   | New. Title, explanation, figures, actions.                                                                                            |
| `apps/web-spa/app/features/common/components/back-office-figure-card.tsx`                 | New. One small figure card.                                                                                                           |
| `apps/web-spa/app/features/common/components/back-office-table-frame.tsx`                 | New. The table frame.                                                                                                                 |
| `apps/web-spa/app/features/common/components/back-office-status-badge.tsx`                | New. A word badge in one of four tones.                                                                                               |
| `apps/web-spa/app/features/common/hooks/use-back-office-pagination-labels.ts`             | New. Returns the three translated pagination labels, so six list pages do not repeat three `t()` calls.                               |
| `apps/web-spa/app/features/admin-*/components/*.tsx`, `features/catalog/components/*.tsx` | Look only, listed screen by screen below.                                                                                             |
| `apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json`, `en/…en.json`              | One new top-level block `backOffice`, in both languages, at the end of each file (the merge with slice 03 stays a one-place change).  |

All new shared files carry the `back-office-` prefix: slice 03 is built at the same time in
another worktree, and a prefix makes an add/add conflict on a common name impossible. They sit
beside `back-office-layout.tsx`, the seam the spec names. `app-settings-menu.tsx`, the shop and
member layouts, the `Table`, `Badge` and `Sidebar` primitives are not edited.

### The new theme tint

| Token        | Light     | Evening   | Use                                     |
| ------------ | --------- | --------- | --------------------------------------- |
| `straw-tint` | `#FDF6E4` | `#4C5443` | rows and notices that wait for an admin |

The light value is the mockup's. The evening value is 10 % straw mixed into the evening card
(`#3A473F`), so the row reads warmer than its neighbours on slate. Contrast, computed with slice
01's formula, all at 4.5:1 or more, and asserted by `theme.spec.ts`:

| Pair                                                                   | Light | Evening |
| ---------------------------------------------------------------------- | ----- | ------- |
| `foreground` on `straw-tint`                                           | 14.20 | 7.02    |
| `muted-foreground` on `straw-tint`                                     | 7.08  | 4.81    |
| `sidebar-primary-foreground` on `sidebar-primary` (added, was missing) | 5.81  | 5.81    |

Badges on a tinted row carry their own fill, so no other pair sits on the tint.

### The mockup's colours, mapped to the theme

| Mockup                               | Theme                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Row waiting for review, `#FDF6E4`    | `bg-straw-tint` (new)                                                    |
| "À examiner" badge, straw, dark text | `bg-straw text-straw-foreground border-border` (9.16:1)                  |
| "Actif" badge, sage, light text      | `Badge` `default` variant: `bg-primary text-primary-foreground` (5.81:1) |
| "Examiner" row action, sage          | `Button` `default` variant, `size="sm"` (44 px)                          |
| "Ouvrir" row action, outline         | `Button` `outline` variant, `size="sm"`                                  |
| Heading row, kraft tint              | `bg-muted` (`#EDE4D0`, a light kraft; `#26302A` in the evening)          |
| Table frame, 2 px                    | `border-2 border-border rounded-xl bg-card`                              |
| Row lines, 1 px kraft                | `border-rule` (already the `TableRow` default since slice 01)            |
| Sidebar background and border        | `bg-sidebar`, `border-r-2 border-border`                                 |
| Current link, sage                   | `bg-sidebar-primary text-sidebar-primary-foreground`                     |
| "Ouvrir la distribution", straw      | `bg-straw text-straw-foreground border-border`                           |

### `ListPagination`

```ts
interface ListPaginationProps {
  // … the six existing props, unchanged
  /** Visible word beside the "previous" arrow. Without it the button shows the arrow alone, as today. */
  previousLabel?: string
  /** Visible word beside the "next" arrow. Without it the button shows the arrow alone, as today. */
  nextLabel?: string
  /** Text of the page indicator. Defaults to today's `{page} / {pageCount}`. */
  pageOfLabel?: ReactNode
}
```

- Without a label, the button stays `size="icon"` with the arrow alone: byte for byte today's
  markup. With a label, it becomes `size="sm"` (44 px) with the arrow and the word (arrow first
  for "previous", last for "next"). Only when a label is given do the arrows lose their `size-4`
  and take the button's default `size-5`, so the default output does not move.
- The indicator renders `pageOfLabel ?? \`${page} / ${pageCount}\``, same testid.
- The back office passes `t('backOffice.pagination.previous')` ("Précédent"),
  `t('backOffice.pagination.next')` ("Suivant") and
  `t('backOffice.pagination.pageOf', { page, pageCount })`. **The French and English texts keep
  the form "Page {{page}} / {{pageCount}}"**: `members-list.spec.ts` checks that
  `members-page-indicator` contains "1 /" and "2 /", and that test may not be edited.
  "Page 1 sur 3" would turn it red.

### The sidebar and the layout (`back-office-layout.tsx`)

The `Sidebar` primitive and `AppLayout` are not edited. Every change is a class string or a child
passed from the layout, so their props stay as they are.

- `<Sidebar collapsible="offcanvas" className="group-data-[side=left]:border-r-2 border-border">`.
  Today it is `collapsible="icon"`: the desktop trigger folds it to a rail of icons alone, which
  breaks "every link with an icon and a label". `offcanvas` folds it away entirely instead. Below
  768 px it is still the sheet it is today (`isMobile` path, unchanged). The `tooltip` props go:
  they only showed in the icon rail.
- Children, in order:
  1. `<AwningBand />` at the very top of the sidebar.
  2. Header: a link to `/admin/members` holding "Grocery" (`members.title`) in
     `font-serif text-3xl font-bold` (32 px, the theme's step nearest the mockup's 30 px) and, below
     it, `t('backOffice.subtitle')` ("Gestion de l'épicerie") in `text-base text-muted-foreground`.
     The old shield disc and the forced-capitals "ADMIN" go.
  3. `<nav aria-label={t('backOffice.navigation')}>` holding the `SidebarMenu` of the six links:
     members, catalogue, purchasing, inventory, participation (label kept, not "Créneaux"),
     accounting. Each `SidebarMenuButton` keeps its `data-testid` (`back-office-nav-<last path
part>`), gets `aria-current={isActive ? 'page' : undefined}` beside `isActive`, and the
     classes `h-12 gap-3 px-3 font-semibold [&_svg]:size-5 data-active:bg-sidebar-primary
data-active:text-sidebar-primary-foreground hover:data-active:bg-sidebar-primary/90`
     (18 px is the primitive's `text-base`). The visible group label "Gestion" goes; the subtitle
     says it.
  4. Footer (`mt-auto`): "Mon compte" and "Se déconnecter" (`nav-logout`, still
     `text-destructive`, 6.88:1 on the evening sidebar), then, last, the distribution button:
     `Button size="lg"` (52 px) rendered as `<Link to="/distribution" />`,
     `data-testid="back-office-nav-distribution"` (kept, moved out of the link list),
     `HandCoins` icon and `t('backOffice.openDistribution')` ("Ouvrir la distribution"),
     classes `w-full border-border bg-straw text-straw-foreground hover:bg-straw/90`.
- The header bar keeps the sidebar trigger, `back-office-nav-shop` and `AppSettingsMenu`. It gets
  `className="border-b-2 border-rule bg-background"`; the shop link icon loses `mr-2 size-4` (the
  button's own gap and icon size apply).
- The inner `<main>` becomes a `<div>`: `SidebarInset` is already a `main`, and two nested `main`
  landmarks is a fault. Padding `px-8 py-8` (was `p-6`). No test looks the inner `main` up.

### Shared pieces

```tsx
// back-office-page-head.tsx
/** The head of a back office page: Lora title, its explanation, figure cards, page actions. */
export function BackOfficePageHead({
  title,
  description,
  figures,
  actions,
  titleTestId,
}: BackOfficePageHeadProps): ReactElement
interface BackOfficePageHeadProps {
  title: ReactNode
  description?: ReactNode
  figures?: ReactNode // <BackOfficeFigureCard>s
  actions?: ReactNode // buttons on the right of the title
  titleTestId?: string // forwarded to PageTitle (product detail uses `product-detail-name`)
}
```

Markup: `header` `flex flex-wrap items-end justify-between gap-x-8 gap-y-4`; left: `PageTitle`
with `className="text-[3.25rem] leading-[1.1]"` (52 px Lora bold; it stays an `h1`, so
`getByRole('heading')` in `participation-admin.spec.ts` still finds it), then the description
`mt-2 max-w-3xl text-lg text-muted-foreground`; right: the figures (`flex flex-wrap gap-3`) and
the actions (`flex flex-wrap gap-2`).

```tsx
// back-office-figure-card.tsx
/** A small card that shows one number the page already has, with its label. */
export function BackOfficeFigureCard({
  label,
  value,
  testId,
}: {
  label: ReactNode
  value: ReactNode
  testId?: string
}): ReactElement
```

`div` `min-w-36 rounded-xl border-2 border-border bg-card px-4 py-3`, label `text-sm
font-semibold text-muted-foreground`, value `font-serif text-2xl font-bold tabular-nums`. The
`testId` goes on the card, so `toContainText` on the old testids still finds the number.

```tsx
// back-office-table-frame.tsx
/** The frame of a back office table: 2 px border, rounded, heading row tinted, scrolls inside. */
export function BackOfficeTableFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}): ReactElement
```

`div` `overflow-hidden rounded-xl border-2 border-border bg-card` plus descendant classes for the
heading row: `[&_[data-slot=table-head]]:text-sm [&_[data-slot=table-head]]:font-bold`
(the `bg-muted` heading row and `border-rule` lines already come from slice 01's `Table`). The
`Table` primitive's own `table-container` (`overflow-x-auto`) is what scrolls, inside the frame.
The frame replaces the six-times repeated `rounded-lg border border-border` div.

```tsx
// back-office-status-badge.tsx
type StatusTone = 'attention' | 'positive' | 'negative' | 'neutral'
/** A status written as a word, in one of four theme tones. Never a colour alone. */
export function BackOfficeStatusBadge({
  tone,
  children,
  ...badgeProps
}: { tone: StatusTone } & ComponentProps<typeof Badge>): ReactElement
```

Tones: `attention` = `Badge` `variant="outline"` plus `bg-straw text-straw-foreground`;
`positive` = `variant="default"` (sage); `negative` = `variant="destructive"`; `neutral` =
`variant="outline"`. `data-testid` and the other props pass through.

Status tones, page by page:

| Status (word key)                                    | Tone                                                  |
| ---------------------------------------------------- | ----------------------------------------------------- |
| Membership: pending / active / rejected / terminated | attention / positive / negative / neutral             |
| Fee: unpaid, partly paid / paid                      | attention / positive                                  |
| Supplier order: draft / sent / received / closed     | neutral / attention / positive / neutral              |
| Reception line: none / short / over                  | positive / negative / attention                       |
| Slot cancelled, expense cancelled                    | negative (as today)                                   |
| Product archived                                     | neutral (was destructive: archiving is no fault)      |
| Supplier archived, category archived                 | neutral, **new badge** `catalog.archived` ("Archivé") |

Stock has no status word today (only quantities), so nothing changes there.

### Per-screen changes

The search covered every file of `features/admin-accounting`, `features/admin-inventory`,
`features/admin-members`, `features/admin-participation`, `features/admin-purchasing`,
`features/catalog`, and `back-office-layout.tsx`. Commands and results are in Notes & Snippets.

**Forced capitals (4, all go):**

| File and element                        | Today                                               | Becomes                                                                      |
| --------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `back-office-layout.tsx`, "Admin" title | `font-black tracking-tight uppercase text-sm`       | "Grocery" in Lora, see the sidebar                                           |
| `member-detail-page.tsx`, `Field` label | `text-[10px] font-medium uppercase tracking-widest` | `text-sm font-semibold text-muted-foreground`; value `text-lg font-semibold` |
| `product-detail-page.tsx`, price label  | `text-xs font-medium uppercase tracking-widest`     | `text-sm font-semibold text-muted-foreground`                                |
| `product-form-page.tsx`, `Field` label  | same                                                | `text-base font-semibold text-foreground` (a form label)                     |

**Text under 14 px (1):** the `text-[10px]` above. No other arbitrary size.

**Raw colours (1):** `supplier-order-detail-page.tsx`, the skipped-lines notice:
`border-amber-300 bg-amber-50 text-amber-900` and their `dark:` amber twins become
`border-2 border-warning bg-straw-tint text-foreground`, icon `size-5`, text `text-base`.
Squash is used as a border only (non-text), never as text, as slice 01's ruling says. No hex value
was found.

**Faded rows (2):** `suppliers-tab.tsx` and `categories-tab.tsx` mark archived rows with
`opacity-50` only. That is a status by fading alone and drops the row under 4.5:1. The opacity
goes; the name cell gets the neutral "Archivé" badge.

**Readable text.** Rule, the same as slice 02's: a sentence an admin reads (explanation, empty
state, notice, error, dialog hint) is `text-base` (18 px) or more; a short annotation beside a
value (a count, a date line, a number, a unit, a field hint) may be `text-sm` (16 px). Inside a
table, every cell is 16 px or more: the `Table` is `text-base`, the heading row `text-sm`, and the
`text-xs` cells go to `text-sm`. Badges stay 14 px (`text-xs`, slice 01's badge size), as labels,
not body text. Nothing is under 14 px.

- Page explanations (`text-sm muted`) move into `BackOfficePageHead` at `text-lg`.
- `members-list-page.tsx`: number cell `font-mono text-xs` to `font-mono text-sm`; the create
  dialog hint `text-xs` to `text-base`.
- `member-detail-page.tsx`: membership number under the title `text-sm`; history list `text-base`,
  its lines `border-rule`; history status codes stay as they are (data, see questions).
- `member-fee-panel.tsx`: summary `text-base`; "expected" label `text-sm font-semibold`; payment
  list `text-base`, lines `border-rule`.
- `product-detail-page.tsx`: subtitle `text-base`; price history `text-base`, lines `border-rule`.
- `product-form-page.tsx`: the locked sale-mode note `text-base`.
- `reception-form.tsx`: heading `h3` `font-serif text-xl font-semibold`; line labels `text-base`;
  field labels `text-sm font-semibold` (was `text-xs muted`); the hint `text-sm`.
- `supplier-order-detail-page.tsx`: total line `text-base`; receptions heading becomes
  `SectionTitle`; their lines `text-base`; empty text `text-base`. The `supplier-order-receptions
  > ul > li` structure is kept (two tests count it).
- `stock-detail-page.tsx`: movements heading becomes `SectionTitle`; empty text `text-base`.
- `slot-detail-page.tsx`: when-line `text-lg`; signups heading `SectionTitle`; empty `text-base`;
  member number `text-sm`.
- `add-member-dialog.tsx`: member number `text-sm`.
- `slot-form-dialog.tsx`: locked note and error `text-base`.
- `expenses-page.tsx`: reason line in the cell `text-xs` to `text-sm`.
- `profit-and-loss-page.tsx`: wallet note and exports description `text-base`.
- `period-picker.tsx`, `cancel-expense-dialog.tsx`: labels `text-sm` to `text-base font-semibold`.
  The picker's handlers are not touched (the race is a separate task).

**Page heads.** Every page uses `BackOfficePageHead`, title and explanation as today:

| Page                  | Title / explanation (existing keys)                  | Figures                                                            | Actions                               |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| Members list          | `adminMembers.title` / `.subtitle`                   | none (see questions)                                               | create member                         |
| Member detail         | member name / membership number                      | none                                                               | edit, status badge                    |
| Catalogue             | `catalog.title` / `.subtitle`                        | none                                                               | none                                  |
| Product detail        | product name (`product-detail-name`) / supplier line | none                                                               | archive, edit (today's buttons)       |
| Product form          | new / edit                                           | none                                                               | none                                  |
| Purchasing list       | `purchasing.title` / `.subtitle`                     | none                                                               | none                                  |
| Supplier order detail | supplier name / its line                             | none                                                               | status badge, export, send, cancel    |
| Inventory list        | `inventory.title` / `.subtitle`                      | none                                                               | none                                  |
| Stock detail          | product name                                         | on hand (`stock-detail-on-hand`), cost price (`stock-detail-cost`) | none                                  |
| Slots list            | `adminParticipation.title` / `.subtitle`             | none                                                               | new slot                              |
| Slot detail           | role label / when-line                               | places taken (`slot-detail-count`, text "0 / 3" kept)              | edit, cancel, delete; cancelled badge |
| Profit and loss       | `adminAccounting.pnl.title` / `.subtitle`            | none                                                               | none                                  |
| Expenses              | `adminAccounting.expenses.title` / `.subtitle`       | none                                                               | new expense                           |

The figure cards reuse the label keys already on the page (`inventory.columns.onHand`,
`inventory.columns.costPrice`, `adminParticipation.detail.signups`). No new figure, no new data.

**Search and filters.** The members, products and inventory search fields grow to `h-13` (52 px)
and `w-80`. On the members list, the search comes first and the status tabs after it, as in the
mockup; the create button moves to the page head. Purchasing keeps its status tabs. The tabs keep
their component and testids (slice 01 already made them 44 px).

**Tables.** Every table (members, products, suppliers, categories, supplier orders, order lines,
stock, stock movements, slots, expenses, profit and loss) goes into `BackOfficeTableFrame`. Row
actions become `variant="outline" size="sm"` (44 px, word kept). The main action of a row is sage
(`default`) only where the mockup shows it: on the members list, a pending row's action reads
"Examiner" in sage; any other row's reads "Ouvrir" (`backOffice.open`) in outline, same testid
`members-row-review`, same link. Pending rows get `bg-straw-tint`. Action cells that are `td` with
`flex gap-1` (suppliers, categories) become a `td` holding a `div` `flex flex-wrap gap-2`: a
`display: flex` on a cell breaks the table's row height. Testid prefixes used by existing tests
(`supplier-order-line-`, `reception-line-`, `reception-`, `stock-movement-`, `slot-row-`,
`expense-row-`, `supplier-orders-row-`) get no new testid that starts with them.

**Other touches.** Back links (`member-back-to-list`, product, order, stock, slot) and the
`pnl-to-expenses` / `expenses-to-profit-and-loss` links: `ghost` to `outline`, icon margins go
(the button's gap). Panels `rounded-lg border border-border` (member actions, fee panel, price
card, reception form, signups) become `rounded-xl border-2 border-border bg-card`. Icons `mr-2
size-4` inside buttons lose both classes.

### New translation keys

One block, `backOffice`, at the end of both files:

| Key                              | French                        | English                       |
| -------------------------------- | ----------------------------- | ----------------------------- |
| `backOffice.subtitle`            | Gestion de l'épicerie         | Grocery management            |
| `backOffice.navigation`          | Navigation du back-office     | Back office navigation        |
| `backOffice.openDistribution`    | Ouvrir la distribution        | Open the distribution         |
| `backOffice.open`                | Ouvrir                        | Open                          |
| `backOffice.pagination.previous` | Précédent                     | Previous                      |
| `backOffice.pagination.next`     | Suivant                       | Next                          |
| `backOffice.pagination.pageOf`   | Page {{page}} / {{pageCount}} | Page {{page}} / {{pageCount}} |

Reused as they are: `members.title`, `members.nav.myAccount`, `members.nav.logOut`,
`catalog.archived`, the nav keys of each link, every page title and subtitle key.

### The browser test

`apps/web-spa-e2e/tests/back-office-desktop.spec.ts`, as `withRole('admin')`. It never clicks
`nav-logout` and never signs out: the admin session is shared by the suite (slice 02's lesson).
Helpers, copied into the file (spec files do not import each other in this suite):

- `setEveningModeBeforeLoad(page)` — `addInitScript` that sets `localStorage['app-theme'] =
'dark'`.
- `expectNoHorizontalScroll(page)` — `document.documentElement.scrollWidth <= clientWidth`, and
  the same for `[data-slot="sidebar-inset"]` and every element with computed `overflow-x` `auto`
  or `scroll` inside it (the table containers included). Slice 02's lesson: a frame that scrolls
  on its own hides a cut from the page check. At 1440 and 1194 no table may need to scroll.
- `findCutControls(page)` — every visible `button`, `a`, `input`, `[data-slot="badge"]` inside the
  page: its own `scrollWidth` is not above its `clientWidth`, and its box lies inside the viewport.
  Returns the offenders' testid or text.
- `findSmallOrCapitalText(page, scope)` — slice 02's walker: visible text under 14 px or with
  `text-transform: uppercase`; plus, inside `td`, text under 16 px outside a badge.
- `expectPageHead(page)` — the first `h1` in the page is Lora (`Lora Variable` first in its font
  family) and at least 48 px.
- `expectTable(page, frameLocator)` — the frame has a 2 px border and a radius of 16 px; its
  `th` cells are 16 px and bold (≥ 700); every row action button in it is at least 44 px high and
  holds visible text.

Cases, in the order the steps add them (the full list is the criterion check):

1. **Sidebar, at 1440 light.** On `/admin/members`: `[data-slot="awning-band"]` inside
   `[data-slot="sidebar"]`; the text "Grocery" in Lora; the subtitle visible; each of
   `back-office-nav-members`, `-catalog`, `-purchasing`, `-inventory`, `-slots`, `-accounting`
   holds an `svg` and visible text of 18 px; `back-office-nav-members` has
   `aria-current="page"` and is the only one; `back-office-nav-distribution` is visible, at least
   48 px high, holds text and sits below the last link; the sidebar container has a 2 px right
   border; no text under 14 px or in capitals inside the sidebar. Then on `/admin/catalog`,
   `back-office-nav-catalog` is the current one. At 390 × 844: the sidebar links are hidden, the
   trigger opens the sheet, `back-office-nav-catalog` shows in it (the fold-away of today). After
   the desktop trigger is clicked at 1440, the sidebar is gone from view and no icon-only rail is
   left (`back-office-nav-members` not visible).
2. **Members, at 1440 × 900 and 1194 × 834, light and evening.** `/admin/members` (pending tab,
   the default) and `/admin/members?status=all`: page head, table frame, no horizontal scroll, no
   cut control, no small or capital text; `members-search` at least 52 px high; a pending row has
   a "En attente" badge whose background is straw (`rgb(233, 196, 106)`) and its action reads
   "Examiner"; on the `all` tab an active row's action reads "Ouvrir"; pagination prev and next
   hold visible words and the indicator still contains "1 /". Then the first member's detail
   page: page head, no small or capital text, no horizontal scroll.
3. **Catalogue, same four combinations.** `/admin/catalog` on each of the three tabs, a product's
   detail page and the new-product form: page head (catalogue, detail, form), frames, no scroll,
   nothing cut, no small or capital text; an archived supplier row (archived through the API in
   the test's own setup after `resetDb`, then restored) holds the word "Archivé".
4. **Accounting and the rest, same four combinations for accounting.** `/admin/accounting` and
   `/admin/accounting/expenses`: page head, frames, no scroll, nothing cut, no small or capital
   text. At 1440 light only, the sweep of the remaining pages: `/admin/purchasing`, a supplier
   order's detail (created by the same aggregate call the purchasing tests use), `/admin/inventory`,
   a stock detail, `/admin/slots`, a slot's detail: page head, no scroll, nothing cut, no small or
   capital text; `stock-detail-on-hand` and `slot-detail-count` are figure cards
   (`[data-testid=…]` has a 2 px border).

### The order of work, with the first failing test of each step

Each step: write its test first, run it alone and save the red output to
`scratchpad/s04-stepN-red.log` **with its error line copied into the worklog before any
production file of the step is written** (slice 02's retro proposal on proving the red). Then the
production code, then green (`s04-stepN-green.log`), `pnpm typecheck`, the existing specs that
touch the step's pages run alone, format the changed files by name, commit.

1. **Theme tint and pagination labels (`packages/ui`).** First failing tests:
   `theme.spec.ts` gains `straw-tint` in both palettes and its two pairs, and the
   `sidebar-primary` pair; **red**: `--straw-tint is not defined in light mode`.
   `list-pagination.spec.tsx` (new): without labels, the markup has no "Précédent", the buttons
   hold only an `svg`, the indicator reads `2 / 5`, the four testids are there; with
   `previousLabel="Précédent"`, `nextLabel="Suivant"`, `pageOfLabel="Page 2 / 5"`, both words
   and the custom indicator show; **red**: the words are missing from the markup (`expected … to contain
'Précédent'`; Vitest strips types, so the unknown props do not stop the run). Then `globals.css` and `list-pagination.tsx`. Green: `pnpm --filter @grocery/ui
test`.
2. **Sidebar and layout.** First failing test: case 1 of the browser test. **Expected red:** the
   awning band is not found in the sidebar, or "Grocery" is missing. Then `back-office-layout.tsx`
   and the `backOffice` keys it needs. Green; `nav-smoke.spec.ts`, `rbac-admin.spec.ts`,
   `app-settings.spec.ts`, `market-theme.spec.ts` alone.
3. **Shared pieces and the members screens.** First failing test: case 2. **Expected red:** the
   members `h1` is 32 px (under 48), or the member detail labels are in capitals. Then the four
   shared files, the pagination hook, `members-list-page.tsx`, `member-detail-page.tsx`,
   `member-fee-panel.tsx`, `member-profile-edit.tsx`, `member-status-badge.tsx` (uses
   `BackOfficeStatusBadge`), the remaining keys. Green; `members-list.spec.ts`,
   `members-detail.spec.ts` alone.
4. **Catalogue.** First failing test: case 3. **Expected red:** the catalogue `h1` under 48 px,
   the product detail price label in capitals, or no "Archivé" on the archived supplier row. Then
   the six `features/catalog` files. Green; `catalog-products.spec.ts`,
   `catalog-suppliers.spec.ts`, `catalog-categories.spec.ts` alone.
5. **Purchasing, inventory, participation, accounting.** First failing test: case 4. **Expected
   red:** the accounting `h1` under 48 px. Then the purchasing, inventory, participation and
   accounting files. Green; `admin-purchasing-*.spec.ts`, `admin-inventory-stock.spec.ts`,
   `participation-admin.spec.ts`, `accounting.spec.ts` alone.
6. **Gates, close checks, formatting.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
   `pnpm e2e`, each in the background with its full log `scratchpad/s04-gate-*.log`, read in
   full. The close `grep`s of Notes & Snippets. `oxfmt` on the changed files by name, a few at a
   time. Screenshots are the Mason's, after the review.

Every Playwright run (one file, a red run, the full suite) and every use of the E2E stack takes
the lock first (`scratchpad/e2e.lock`, with `s04` and the time
in a file inside), checks `docker ps` for another project on 5434, 1093 and 1043, and removes the
lock as soon as its stack and servers are down. The Typist stops every server it starts in the
same step, by PID, or reports the PIDs.

### How each criterion is checked

| Criterion             | Check                                                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidebar`             | Case 1: band, Lora name, subtitle, six links with icon and label, `aria-current`, distribution button at the bottom, 2 px border, fold-away at 390 and on the desktop trigger. Testids: the whole E2E suite, unedited. |
| `page-heads`          | `expectPageHead` on every page of cases 2 to 4 (thirteen pages).                                                                                                                                                       |
| `tables`              | `expectTable` on the members, products, suppliers, categories, supplier orders, stock, slots, expenses and profit-and-loss frames; `expectNoHorizontalScroll` covers the frames; the review reads the six files.       |
| `status-words`        | Case 2 (pending badge text and fill) and case 3 ("Archivé"); the tone table above read at the review; `grep -n 'opacity-50'` on the files empty.                                                                       |
| `pagination-labels`   | `list-pagination.spec.tsx` (default output unchanged, labels shown); case 2 (words visible, indicator still "1 /"); `git diff` of `list-pagination.tsx` shows only added optional props.                               |
| `no-forced-capitals`  | `grep -rn uppercase` on the files empty; the walker in cases 1 to 4.                                                                                                                                                   |
| `readable-text`       | `grep -rnE 'text-\[[0-9.]+(px                                                                                                                                                                                          | rem)\]'`finds only the 52 px title;`grep -rn 'text-xs'`lines read one by one (badges and annotations only, none in a`td`); the walker's 14 px and 16 px-in-tables floors. |
| `theme-colours-only`  | The raw-colour and hex `grep`s of Notes & Snippets empty on the files; `theme.spec.ts` for the new tint.                                                                                                               |
| `no-overflow-desktop` | Cases 2 to 4 at 1440 × 900 and 1194 × 834, light and evening; the step 2 to 5 red logs prove the test failed before the change; screenshots of every page at both widths and modes.                                    |
| `i18n-intact`         | A scratchpad Node check that the French and English files hold the same keys; `grep` for quoted French words in the changed `.tsx`; the review.                                                                        |
| `e2e-green`           | `pnpm e2e` full log; `git diff --stat 9b98504 -- apps/web-spa-e2e` shows only the new file.                                                                                                                            |
| `suite-green`         | The four gate logs.                                                                                                                                                                                                    |

### Questions for the Architect

1. **Figure cards on the members list.** The mockup puts figures ("à examiner", "actifs") beside
   the title. The page only knows the count of the tab it shows, and that count is already under
   the table. Recommendation: no figure card on the members list (a second copy of one number
   adds nothing); figure cards only where a page shows numbers beside its title today: stock
   detail (on hand, cost price) and slot detail (places taken). The other way: one card with the
   current tab's count, which repeats the line under the table.
2. **The sidebar folds away instead of shrinking to icons.** `collapsible="icon"` leaves a rail of
   icons alone, which the `sidebar` criterion and the parent's `icon-with-label` rule out. I move
   to `offcanvas`: the desktop trigger hides the whole sidebar. Below 768 px nothing changes.
   Recommendation: accept.
3. **Four new shared files beside the layout** (`back-office-page-head.tsx`,
   `back-office-figure-card.tsx`, `back-office-table-frame.tsx`, `back-office-status-badge.tsx`)
   and one hook (`use-back-office-pagination-labels.ts`). The spec's seams name the layout and the
   screens, not new files. Without them the same head, frame and tone classes are repeated in
   thirteen pages. The `Table` and `Badge` primitives are left alone because slice 03 uses them at
   the same time. Recommendation: accept.
4. **"Examiner" in sage for pending rows, "Ouvrir" in outline for the others**, as in the mockup.
   Same testid, same link; the label of the non-pending rows changes from "Examiner" to "Ouvrir".
   No test reads that label. Recommendation: accept.
5. **The page indicator stays "Page 1 / 3", not "Page 1 sur 3".** `members-list.spec.ts` checks
   the text "1 /", and the spec forbids editing it. Recommendation: accept.
6. **The member status history shows raw codes** (`pending → active`). They are data words from
   the API, not translated. Translating them with `members.status.*` is a two-line change in a
   file this slice touches. Recommendation: do it in step 3, it fits `status-words`; or leave it
   for a follow-up if you see it as a behaviour change.
7. **Table body text: 18 px, not the mockup's 17 px.** The theme has no 17 px step; `text-base`
   (18 px) is what the `Table` already uses, and the criterion asks for 16 px or more. If the
   1194 px screenshots show a table too tight, the frame drops its body to `text-sm` (16 px).
   Recommendation: accept.

## Worklog

- 2026-11-25 — Mason: read the reading list (README, documentation index, general and frontend
  guidelines, constitution headings, `CONTRIBUTING.md`, `.cursor/rules`, the journal), the parent
  spec and this slice's spec, slices 01 and 02 (spec, work document, rulings, findings, retro),
  the layout, the `Sidebar`, `Table`, `Badge`, `PageTitle` and `ListPagination` components, the
  theme test, every back office screen, and the E2E tests that touch the back office. Ran the
  searches below. The reference canvas could not be read from here (the artifact is private to
  the owner); the plan follows the spec's description and the Architect's brief. Wrote this plan.
  No production code yet. `pnpm install` ran in the worktree.
- 2026-11-25 — Typist, step 1, red. Wrote `theme.spec.ts` additions and the new
  `list-pagination.spec.tsx` first. Red log
  `/private/tmp/claude-501/-Users-tatiana-Workspace-perso-grocery/5f01a6da-c31d-4b21-b8df-1536a0650815/scratchpad/s04-step1-red.log`.
  Error lines: `Error: --straw-tint is not defined in light mode` (and in dark mode), and
  `AssertionError: expected '<div class="flex items-center gap-2 t…' to contain 'Précédent'`.
  7 tests red. The `sidebar-primary` pair is green already, as the plan expects (it was only missing).
  The first red run had a wrong regex in my "no labels" test; I fixed it and reran, so the saved log
  is the second run.
- 2026-11-25 — Typist, step 1, green. Added `--straw-tint` (light and evening, mapped in `@theme
inline`) and the three optional `ListPagination` props. Green log `s04-step1-green.log` in the
  scratchpad: 4 files, 136 tests pass. `pnpm typecheck` passes. No departure.
- 2026-11-25 — Typist, step 2, red. Wrote case 1 of `back-office-desktop.spec.ts` first (four
  tests: sidebar at 1440, current link on the catalogue page, desktop fold-away, phone sheet). Ran
  it under the lock. Red log `s04-step2-red.log` in the scratchpad. 3 red, 1 green (the phone
  sheet already works, as the plan says). Error lines: `Locator:
locator('[data-slot="sidebar"]').locator('[data-slot="awning-band"]')` with `element(s) not
found`; `Expected: "page"  Received: ""` on `back-office-nav-catalog` (aria-current); and
  `Expected: not in viewport  Received: in viewport` on `back-office-nav-members` (today's icon
  rail keeps the links in view). Waited about 30 minutes for the lock, the other Mason's runs took
  it again each time I polled slowly.
- 2026-11-25 — Typist, step 2, green. Rewrote the sidebar in `back-office-layout.tsx` as planned
  (offcanvas, awning band, Lora name and subtitle, six links with `aria-current`, footer with
  account, logout and the straw distribution button; header bar border; inner `main` became a
  `div`). Added the `backOffice` block (`subtitle`, `navigation`, `openDistribution`) at the end of
  both locale files. Green log `s04-step2-green.log`: 5 passed (the four tests of case 1 and the
  setup). Existing specs `nav-smoke`, `rbac-admin`, `app-settings`, `market-theme` run alone: 15
  passed (`s04-step2-existing.log`). `pnpm typecheck` passes. No departure. The `ShieldCheck`
  import stays, the access-denied panel still uses it. The `backOffice.open` and
  `backOffice.pagination.*` keys come in step 3.
- 2026-11-25 — Typist, step 3, red. Wrote case 2 first: the helpers (`setEveningModeBeforeLoad`,
  `expectNoHorizontalScroll`, `findCutControls`, `expectPageHead`, `expectTable`, a frame finder) and
  three tests (list on the pending tab, list on the `all` tab, first member's detail) for each of
  the four size and mode pairs. Red log `s04-step3-red.log` in the scratchpad: 12 red (the setup
  passes). Error lines: `Expected: "2px"  Received: "1px"` (table frame border) and
  `Expected: >= 48  Received: 32` (the `h1`). Run under the lock.
- 2026-11-25 — Typist, step 3, green. Added the four shared files and the pagination hook
  (`features/common`), rewrote `members-list-page.tsx` (page head, search first then tabs, frame,
  straw-tint pending rows, "Examiner" in sage or "Ouvrir" in outline, pagination words),
  `member-detail-page.tsx` (page head, outline back link, labels no longer capitals, history codes
  translated with `members.status.*`), `member-fee-panel.tsx` and `member-status-badge.tsx` (tones;
  new `MemberFeeBadge` so the three fee badges share one tone map). Added `backOffice.open` and
  `backOffice.pagination.*` in both languages. Green log `s04-step3-green.log`: 17 passed (setup,
  4 sidebar tests, 12 members tests). Existing `members-list` and `members-detail` specs alone: 12
  passed (`s04-step3-existing.log`). `pnpm typecheck` passes. Departures: `member-profile-edit.tsx`
  needed no change, so it is untouched. The fee value in the detail grid is now a badge instead of
  plain text (a fee badge reads the same word).
- 2026-11-25 — Typist, step 4, red. Wrote case 3 first (per size and mode: the three catalogue
  tabs, a product detail plus the new-product form, an archived supplier row). Red log
  `s04-step4-red.log` in the scratchpad: 20 red, 0 green (the setup passes). Error lines:
  `Expected: "2px"  Received: "1px"` (frame), `Expected: >= 48  Received: 32` (`h1`), and
  `Expected substring: "Archivé"  Received string: "Ferme des PrésProducteur6ModifierRestaurer"`.
  Departure from the plan, test side: the catalogue page never asks the API for archived suppliers
  or categories (`includeArchived` is always `false`), so an archived row cannot be reached by
  archiving through the API and opening the page. The test instead rewrites the suppliers answer
  in the browser (`page.route`) so the first supplier comes back with `archivedAt` set. The page
  code is not touched for this. Open question for the Architect: the "Archivé" badge on suppliers
  and categories is today unreachable by a user; the plan keeps the badge, and so do I.
- 2026-11-25 — Typist, step 4, green. Rewrote the six `features/catalog` files as planned (page
  head on the catalogue, product detail and product form; frames; outline row actions; wrapped action
  cells; search at 52 px; pagination words; `opacity-50` gone, replaced by a neutral "Archivé" badge
  in the name cell of suppliers and categories, testids `supplier-archived-badge` and
  `category-archived-badge`; product archived badge neutral; no capitals, no 10 px text). Green log
  `s04-step4-green.log`: 37 passed (setup, case 1, case 2, case 3). Existing specs
  `catalog-products`, `catalog-suppliers`, `catalog-categories`, `members-list`, `members-detail`
  alone: 25 passed (`s04-step4-existing.log`). `pnpm typecheck` passes.
  Departures, found by the new test at 1194 px (two real defects, both fixed with the smallest
  change):
  1. The products table pushed the whole content area wider than the window (page scroll of 145 px).
     Cause: the content column had no `min-w-0`, so a nowrap table set its minimum width. Fix:
     `className="min-w-0"` passed to `AppLayout` from `back-office-layout.tsx` (a prop that
     already exists; `AppLayout` itself is untouched).
  2. After that fix the products table still needed to scroll inside its frame at 1194 px (1015 px
     of table in 870 px), because of long names with `whitespace-nowrap` cells. Fix:
     `BackOfficeTableFrame` lets body cells wrap (`[&_[data-slot=table-cell]]:whitespace-normal`).
     Heading cells stay on one line. This touches every framed table, so steps 3 to 5 tests cover it.
     One run (`s04-step4-green-run1-hang.log`) had a browser session crash ("Protocol error ... session
     closed", 8.6 minutes) on two tests; the same file passed on rerun without changes (37 passed).
- 2026-11-25 — Typist, step 5, red. Wrote case 4 first: accounting and expenses at four size and
  mode pairs, and at 1440 light the purchasing journey (aggregate by the supplier tab, draft detail
  with the skipped notice, send, reception form, the list), inventory (list and a stock detail
  with its two figure cards), slots (list and a slot detail with its count card). Red log
  `s04-step5-red.log` in the scratchpad: 11 red, 0 green (the setup passes). Error lines:
  `Expected: "2px"  Received: "1px"` (table frame border, first check of each test). The first
  check hides the later ones, so the `h1` and figure card checks are proven at the green run.
- 2026-11-25 — Typist, step 5, green. Rewrote the purchasing (list, order detail, reception form),
  inventory (list, detail with two figure cards), participation (list, detail with the count card,
  two dialogs for small text) and accounting (profit and loss, expenses, period picker labels,
  cancel dialog label) files as planned. Supplier order tones: draft neutral, sent attention,
  received positive, closed neutral; reception lines none positive, short negative, over attention.
  The skipped-lines notice uses `border-warning bg-straw-tint text-foreground`. Green log
  `s04-step5-green.log`: 48 passed (setup, cases 1 to 4). Existing specs `admin-purchasing-aggregate`,
  `admin-purchasing-reception`, `admin-inventory-stock`, `participation-admin`, `accounting` alone:
  27 passed (`s04-step5-existing.log`). `pnpm typecheck` passes. Departures: `record-expense-dialog.tsx`,
  `delete-slot-dialog.tsx` and `cancel-slot-dialog.tsx` needed no change, so they are untouched.
  The slot detail count card shows the old text "0 / 3" under the label "Inscrits" (the existing
  `adminParticipation.detail.signups` key).
- 2026-11-25 — Typist, step 6. Gates, each with its full log in the scratchpad: `pnpm lint`
  (`s04-gate-lint.log`, exit 0, only warnings in files this slice does not touch), `pnpm typecheck`
  (`s04-gate-typecheck.log`, exit 0), `pnpm test` (`s04-gate-test.log`, exit 0: i18n 15, ui 136,
  api 735 tests), `pnpm build` (`s04-gate-build.log`, exit 0), `pnpm e2e` (`s04-gate-e2e.log`):
  218 passed, 1 failed. The one failure is the known flaky accounting period filter test
  (`accounting.spec.ts:107`, `pnl-expenses-total` still showed the old total). Rerun alone:
  `accounting.spec.ts` 9 passed (`s04-gate-e2e-rerun-accounting.log`). No existing test was edited,
  skipped or deleted: `git diff --stat 9b98504 -- apps/web-spa-e2e` shows only the new
  `back-office-desktop.spec.ts`. Close checks run from `apps/web-spa/app` on the criterion files
  plus the five new shared files: `uppercase` none; arbitrary text sizes only the 52 px title
  (`text-[3.25rem]` in `back-office-page-head.tsx`); raw colours none; hex none; `text-xs` none;
  `opacity-50` none; `text-primary` and `text-warning` none; `mr-2` none; every `text-sm` line read
  (labels, annotations, member numbers; none inside a table cell except member and slot numbers and
  the expense reason line, all 16 px). The French and English locale files hold the same 690 keys.
  A search for quoted French words in the changed `.tsx` files found none. `oxfmt --check` on the 37
  changed files: all formatted. Departures: none new. Screenshots are the Mason's.

## Implementation Checkboxes

- [x] Step 1 — theme tint and `ListPagination` labels: unit tests red, then green
- [x] Step 2 — sidebar and layout: browser case 1 red, then green
- [x] Step 3 — shared pieces and members screens: case 2 red, then green
- [x] Step 4 — catalogue: case 3 red, then green
- [x] Step 5 — purchasing, inventory, participation, accounting: case 4 red, then green
- [x] Step 6 — five gates green, close checks, files formatted

## Notes & Snippets

**Architect's rulings at the plan reading** (Architect, 2026-11-25, written by the Mason):

1. **Figure cards: accepted**, only where the number already sits beside the title: stock detail
   (on hand, cost price) and slot detail (places taken). No card on the members list.
2. **`offcanvas` instead of `icon`: accepted.**
3. **The new `back-office-*` shared files in `features/common`: accepted.** They are named in the
   seams below. Slice 03 touches none of them.
4. **"Examiner" in sage for pending rows, "Ouvrir" in outline for the others: accepted.**
5. **Status history codes translated** with the existing `members.status.*` keys: accepted. It
   changes the display only. Done in step 3.
6. **Table body at 16 px if 1194 px is too tight: accepted.** It never goes below 16 px.

Also accepted: the indicator reads "Page 1 / 3"; badges stay at 14 px; the `Table` and `Badge`
primitives stay untouched; the inner `main` becomes a `div`; the supplier order tones; the neutral
"Archivé" badge; `--straw-tint` with the theme test.

**Seams of this slice, as ruled:** the layout `back-office-layout.tsx`; `ListPagination`; the
theme file `globals.css` (one token) and its test; the back office screens in `features/admin-*`
and `features/catalog`; and the new shared files `back-office-page-head.tsx`,
`back-office-figure-card.tsx`, `back-office-table-frame.tsx`, `back-office-status-badge.tsx` and
`hooks/use-back-office-pagination-labels.ts` in `features/common`.

**Architect's notes during the plan reading** (Architect, 2026-11-25, found by slice 03; written
by the Mason):

- **The lock holds for every Playwright run.** Outside CI, `playwright.config.ts` reuses any
  server already listening on 3060 or 5273 (`reuseExistingServer`). A run without the lock can
  silently test slice 03's code from the other worktree. So every Playwright run takes
  `scratchpad/e2e.lock` first: single test files, red runs, green runs, the full suite and the
  screenshots alike. The Typist's brief repeats it.
- **The settings control stays icon-only**, under slice 02's ruling 2 exception. This slice
  builds no second settings menu; `AppSettingsMenu` is reused in the header bar as it is.

**Searches run on 2026-11-25** from `apps/web-spa/app`, over the files of the criteria
(`F` = `features/admin-accounting features/admin-inventory features/admin-members
features/admin-participation features/admin-purchasing features/catalog
features/common/components/back-office-layout.tsx`; run with `bash -c`, the login shell is zsh and
does not split `$F`):

- `grep -rn uppercase $F` — 4 lines: `member-detail-page.tsx` (`Field` label),
  `product-detail-page.tsx` (price label), `product-form-page.tsx` (`Field` label),
  `back-office-layout.tsx` (sidebar title).
- `grep -rnE 'text-\[[^]]+\]' $F` — 1 line: `member-detail-page.tsx` `text-[10px]`.
- `grep -rnE '(bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|divide|shadow|accent|caret)-(red|green|lime|amber|yellow|orange|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black)\b' $F`
  — 1 line: `supplier-order-detail-page.tsx`, the amber notice (six amber classes). (`slate` is a
  theme token since slice 01; a `bg-slate` hit at the close is the token.)
- `grep -rnE '#[0-9a-fA-F]{3,8}\b' $F` — nothing.
- `grep -rn 'text-xs' $F` — 12 lines; `grep -rn 'text-sm' $F` — 34 lines. Each is sorted by the
  readable-text rule above.
- `grep -rnE 'text-(primary|warning)\b' $F` — nothing (only `text-primary-foreground`).
- `grep -rn 'opacity-50' $F` — 2 lines: the archived supplier and category rows.

**E2E locators checked:** the admin specs find rows and lines by testid prefixes
(`supplier-order-line-`, `reception-line-`, `reception-`, `stock-movement-`, `slot-row-`,
`expense-row-`, `supplier-orders-row-`), count `supplier-order-receptions > ul > li`, read
`stock-detail-on-hand`, `stock-detail-cost` and `slot-detail-count` with `toContainText`, read
`members-page-indicator` with `toContainText('1 /')`, find a slot title with
`getByRole('heading')`, and find "Rien à agréger pour ce fournisseur" by text. `nav-logout` is
clicked only by `auth-logout.spec.ts` (member space). No test clicks `back-office-nav-*` or reads
a row action's label.

**Contrast arithmetic** (slice 01's formula): evening tint candidates, straw mixed into the
evening card: 10 % `#4C5443` (foreground 7.02, muted 4.81), 15 % `#545A45` (muted 4.37, fails),
so 10 %. Light tint `#FDF6E4`: foreground 14.20, muted 7.08.

**Width arithmetic at 1194 px:** sidebar 256 px, page padding 2 × 32 px, so 874 px for a table.
The members table holds six columns; the widest is the e-mail or phone column. The browser test
measures it; if it does not fit, the identifier cell gets `max-w-64 truncate` with a `title`.

## Diff-Review Findings

Written after `code-review`.
