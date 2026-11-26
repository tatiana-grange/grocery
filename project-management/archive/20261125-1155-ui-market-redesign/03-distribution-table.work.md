# 03 — Distribution table — work

Created by the Mason at the plan step, 2026-11-25. Spec:
`project-management/tasks/20261125-1155-ui-market-redesign/03-distribution-table.spec.md`.
The parent spec, with the owner's decisions, is
`project-management/tasks/20261125-1155-ui-market-redesign.spec.md`. The theme tokens, the
`AwningBand` and the browser test `market-theme.spec.ts` come from slice 01
(`01-theme-and-shared-components.work.md`, "The tokens" and "The awning band"). The phone test
`member-phone.spec.ts`, its layout helpers and the text-size rule come from slice 02
(`02-member-space-and-sign-in.work.md`, "Per-screen changes" and "The order of work").

Work happens in the worktree `.worktrees/s03-distribution`, branch `feat/ui-market-distribution`,
cut from `feat/ui-market-redesign` at `9b98504`. Slice 04 is built at the same time in
`.worktrees/s04-back-office`.

**Plan:** approved by the Architect, 2026-11-25, with the rulings in Notes & Snippets.

## Program Design

### What changes, in one paragraph

The distribution layout gets the awning band, a market top bar ("Distribution" in Lora, then the
shop, account and sign-out controls, each with an icon and a word, and the icon-only settings
button of ruling 1), and a two-column body
from 1024 px up: the member search on the left (400 px, sticky, 2 px right border), the page on the
right. Below 1024 px the same search sits above the page. The search leaves the home page and
becomes one component that the layout renders once; the open member's result carries
`aria-current="page"`. The member page is rebuilt top to bottom as the mockup orders it: number and
name, the balance block, an "À remettre" section holding each order as a card with one list of
lines and a kraft footer with the total and a 72 px "Valider la remise", any warning, then a row of
72 px actions. The express sale, the receipt, the payment panel and the three wallet dialogs follow
the same look. Forced capitals, raw amber and the small labels go. Routes, guards, API calls,
journeys and every existing `data-testid` stay. One new browser test file at 1194 × 834 (and
768 × 1024) is written first and proves it. No existing test is edited.

### How the search moves into the layout without a second copy

- The search markup and its state leave `distribution-home-page.tsx` and go into a new component,
  `DistributionMemberSearch`, in `features/distribution/components/distribution-member-search.tsx`.
  `distribution-layout.tsx` renders it once, in an `aside` beside the `main` that holds the
  `Outlet`. No page renders it. So there is one `distribution-member-search`, one
  `distribution-search-results`, one `distribution-search-empty`, and one
  `distribution-member-row-<id>` per member, on every page of the layout.
- One markup for all widths: the body is `lg:grid lg:grid-cols-[400px_minmax(0,1fr)]`. Below
  1024 px (`lg`) the `aside` simply comes first in the flow, above the `main`. No CSS-hidden copy,
  so no locator can ever match two elements (the lesson of slice 02's tab bar does not even arise).
- The component lives under the layout route, so it is not unmounted when a member page opens:
  the typed text and the results stay. Picking another result navigates straight to that member.
- The current member is read with `useMatch('/distribution/members/:memberId/*')`, not
  `useParams`: the layout sits above the route that owns the param, and `useMatch` says exactly
  which URL counts. The express page (`/distribution/members/:id/express`) keeps that member
  current.
- The search query keeps its key `['distribution', 'members', search]`, so the existing
  `invalidateQueries({ queryKey: ['distribution'] })` after a handover also refreshes the status of
  the results ("2 commandes en attente" becomes "Rien en attente").

```tsx
// features/distribution/components/distribution-member-search.tsx
/** The table's member search, rendered once by the distribution layout beside every page. */
export function DistributionMemberSearch(): ReactElement
```

### Files

| File                                                                                          | Change                                                                                                                           |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web-spa-e2e/tests/distribution-tablet.spec.ts`                                          | New browser test at 1194 × 834 (and 768 × 1024), grown step by step.                                                             |
| `apps/web-spa/app/features/common/components/distribution-layout.tsx`                         | Awning band, market top bar, the two-column body with the search column. Guard and access-denied screen unchanged word for word. |
| `apps/web-spa/app/features/distribution/components/distribution-member-search.tsx`            | New. The search label, field and results, moved from the home page.                                                              |
| `apps/web-spa/app/features/distribution/components/distribution-notice.tsx`                   | New. The one warning and success box of the table (see "Shared notice").                                                         |
| `apps/web-spa/app/features/distribution/components/distribution-home-page.tsx`                | Search removed; waiting lists restyled.                                                                                          |
| `apps/web-spa/app/features/distribution/components/distribution-member-page.tsx`              | Rebuilt in the mockup's order.                                                                                                   |
| `apps/web-spa/app/features/distribution/components/handover-form.tsx`                         | Becomes the whole order card body: one list of lines, kraft footer, 72 px validate button. Logic unchanged.                      |
| `apps/web-spa/app/features/distribution/components/insufficient-balance-dialog.tsx`           | Market look, `DistributionNotice` for the shortfall.                                                                             |
| `apps/web-spa/app/features/distribution/components/express-order-form.tsx`                    | Market look, over-stock pill, labelled remove button, 72 px submit.                                                              |
| `apps/web-spa/app/features/distribution/components/handover-receipt-page.tsx`                 | Market look, difference pill, reverse panel.                                                                                     |
| `apps/web-spa/app/features/wallet/components/record-payment-form.tsx`                         | 18 px labels, 48 px method buttons, 64 px submit.                                                                                |
| `apps/web-spa/app/features/wallet/components/correct-payment-dialog.tsx`, `refund-dialog.tsx` | 18 px sentences and labels, 48 px method buttons.                                                                                |
| `apps/web-spa/app/features/wallet/components/wallet-panel.tsx`                                | Kraft dividers, balance in Lora italic. Still used by `/account`.                                                                |
| `apps/web-spa/app/features/wallet/components/negative-balance-notice.tsx`                     | Squash warning look. Still used by `/cart` and `/account`.                                                                       |
| `apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json`, `en/common.locales.en.json`    | The new keys below, in one block per file.                                                                                       |

`packages/ui`, `app-settings-menu.tsx`, `app-settings-items.tsx` (imported, not edited), the shop
and member layouts, routes, guards and the API are not touched. `topup-form.tsx` and
`topup-return-page.tsx` sit in `features/wallet` but slice 02 already brought them to the criteria;
they are only re-checked by the `grep`s.

### The layout

```
div  min-h-svh bg-background  data-testid="distribution-layout"
├─ AwningBand
├─ header  flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-border bg-card px-6 py-3
│   ├─ Link "Distribution"  font-serif text-3xl font-bold  data-testid="distribution-home-link"
│   └─ nav aria-label=distribution.nav.main  ml-auto flex flex-wrap items-center gap-2
│       ├─ Button outline (48 px)  Store icon + "Retour à la boutique"  data-testid="distribution-nav-shop"
│       ├─ Button ghost (48 px)    User icon + "Mon compte"             data-testid="distribution-nav-account"
│       ├─ Button ghost (48 px)    LogOut icon + "Se déconnecter"       data-testid="nav-logout" (text-destructive kept)
│       └─ AppSettingsMenu, unchanged: icon-only with `aria-label` and `title` (ruling 1)
├─ div  lg:grid lg:grid-cols-[400px_minmax(0,1fr)]
│   ├─ aside aria-label=distribution.search.label  border-b-2 border-border bg-card p-6
│   │        lg:sticky lg:top-0 lg:max-h-svh lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r-2
│   │   └─ DistributionMemberSearch
│   └─ main  min-w-0 p-6 lg:p-8   → Outlet
└─ Toaster position="bottom-right" richColors
```

- The `HandCoins` disc goes; the name alone is the brand, as on the sign-in pages.
- The mockup's session date and handover progress pill are **dropped**: no API gives a session date
  or a count of handovers done.
- The `aside` is sticky with its own vertical scroll, so on a long member page the search stays in
  view. It is a scroll frame: the new test checks it for sideways overflow too (lesson of slice 02).
- The header wraps on two lines between 768 px and about 900 px rather than overflow.

### The search column

- Label: `<label htmlFor="distribution-member-search">` `font-serif text-xl font-semibold` (24 px),
  text `distribution.search.label` ("Trouver un adhérent").
- Field: the `Input`, `id` and `data-testid` unchanged, `h-16 text-xl` (64 px high, 24 px text; the
  theme scale has no 22 px), full width of the column.
- Results: a `ul` inside `data-testid="distribution-search-results"`; skeleton and
  `distribution-search-empty` (`text-base`) as today.
- Each result is a router `Link` (was a `button` calling `navigate`; same target), so
  `aria-current="page"` has its proper meaning. `data-testid="distribution-member-row-<id>"` kept.
  Classes: `group flex min-h-19 w-full items-center gap-3 rounded-xl border-2 border-border bg-card
p-4 text-left hover:bg-accent aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground`
  (76 px). Inside:
  - name `text-lg font-bold` (20 px);
  - number `text-sm text-muted-foreground group-aria-[current=page]:text-primary-foreground`,
    `data-testid="member-number"` kept (16 px annotation; 5.81:1 on sage);
  - on the right, the status: a straw pill (`rounded-full bg-straw px-3 text-sm font-semibold
text-straw-foreground`, 9.16:1, readable on the sage row too) with
    `distribution.search.outstanding` when orders wait, otherwise plain text
    `distribution.search.nothingOutstanding`; under it the balance, `text-sm tabular-nums`. The
    words carry the status, the straw only decorates.

### The member page

Top to bottom, inside `data-testid="page-distribution-member"`:

1. **Identity and balance**, a `flex flex-wrap items-start justify-between gap-6` row.
   - Left: the number `text-base text-muted-foreground`, then `PageTitle` with
     `className="text-5xl"` (48 px Lora; the mockup's 52 px is not on the theme scale).
   - Right: the balance block, `data-testid="distribution-member-balance-block"`:
     `rounded-xl border-4 border-border bg-slate px-6 py-4 text-slate-foreground` (10.51:1), the
     word `distribution.member.balance` (`text-base`), then the amount `font-serif text-3xl
font-bold italic tabular-nums`, `data-testid="distribution-member-balance"` kept. In evening
     mode the slate block sits on a slate page: its kraft border outlines it. A negative balance no
     longer turns the amount `text-destructive` (brick on slate is unreadable): the minus sign and
     the negative-balance notice say it in words.
2. **Receipt banner** after a handover (`handover-receipt`, `handover-receipt-link` kept), in
   `DistributionNotice tone="success"`; the link becomes `Button variant="link"` rendering the
   router `Link` (48 px).
3. **"À remettre"** section, `data-testid="distribution-to-hand-over"`: heading `SectionTitle`
   `text-2xl` (28 px) `distribution.member.toHandOver`, beside a straw pill
   `distribution.search.outstanding` with the number of orders (only when there is at least one).
   Then `distribution-nothing-to-collect` (`text-base`) or one card per order:
   `section data-testid="distribution-order-<id>"` `overflow-hidden rounded-xl border-2
border-border bg-card`; its header (`border-b border-rule p-4`): the mode badge, the date
   (`text-sm`), the readiness badge (`order-readiness-*` kept), the order total. Then
   `HandoverForm`, which now renders the lines and the footer (below).
4. **Warnings**, after the list, as the criterion orders them: `distribution-member-negative-notice`
   and `distribution-member-status-warning` in `DistributionNotice tone="warning"`.
5. **Actions**, `data-testid="distribution-actions"`, `flex flex-wrap gap-3`, every button
   `h-18 px-6 text-lg` (72 px):
   - `wallet-record-payment`: squash fill, `className="bg-warning text-warning-foreground
hover:bg-warning/90"` on the default variant (`cn` merges it over `bg-primary`), `Banknote` icon;
   - `distribution-start-express`: `outline`, `ShoppingBasket` icon;
   - `wallet-refund-open` (admins): `outline`, `Undo2` icon.
     The validate button is not in this row: each order validates on its own (question 3).
6. The payment panel (`InsufficientBalanceDialog`), right under the actions when open.
7. `WalletPanel` with its history, then the refund and correction dialogs, as today.

### The order card body (`HandoverForm`)

The order today lists its lines twice: once with "ordered / on the shelf" and the not-ready reason,
then again in the form with the quantity input. They become **one list** (question 2), rendered by
`HandoverForm`, which already receives the whole `order`. Its state, total, mutation and refusal
handling do not change.

Each line, `li data-testid="handover-line-<id>"`, `flex flex-wrap items-center gap-x-6 gap-y-2
px-4 py-3`, divided by `divide-y divide-rule` (1 px kraft):

- name `text-lg font-semibold` (20 px), and under it, when not ready, the reason
  `text-sm text-destructive` `data-testid="distribution-line-not-ready"` (moved here from the page);
- "Commandé n" and "En rayon n" (`text-base`, label muted), `distribution-line-available` kept
  with its `text-destructive` on a negative stock;
- handable: the quantity `Input` `h-12 w-28 text-lg`, `handover-qty` kept, inside a label
  "Remis" (`text-base`); then the line price `text-lg tabular-nums`;
- not handable: `handover-excluded` (`text-base text-muted-foreground`) reads "Déjà remis" as today,
  or, for a not-ready line, `distribution.line.notHandedOver` ("Pas remise cette fois"). The
  reason stays visible in the same row, under the name (`distribution-line-not-ready`), as ruling 2
  requires: the distributor needs it to answer the member.

Footer, `flex flex-wrap items-center gap-4 border-t-2 border-rule bg-kraft/40 p-4 dark:bg-muted`
(ink on kraft-tinted card 12.3:1; cream on evening muted 12.12:1; at night the kraft tint over the
slate card would be 3.94:1, hence `dark:bg-muted`): the label `distribution.member.aboutToCharge`
("À débiter", `text-base`), the total `font-serif text-3xl font-bold italic tabular-nums`
(`handover-total` kept), and `handover-submit` `ml-auto h-18 min-w-64 px-8 text-lg` with a
`Check` icon, default (sage) variant: the primary button, the widest of the page. The refusal
(`handover-refusal`) shows under the footer in `DistributionNotice tone="warning"`.

The mockup's 30 px checkboxes are **dropped**: a handover is entered as a quantity per line, and a
checkbox would be a new way to hand over.

### Shared notice

```tsx
// features/distribution/components/distribution-notice.tsx
/** A boxed message of the table: a warning (squash border, light squash ground) or a success. */
export function DistributionNotice({
  tone,
  className,
  children,
  ...props
}: DistributionNoticeProps): ReactElement
interface DistributionNoticeProps extends ComponentProps<'div'> {
  tone: 'warning' | 'success'
}
```

- `warning`: `role="alert"` is **not** added (the existing notices have none, and an alert role
  changes what screen readers announce; out of scope). Classes `flex items-start gap-3 rounded-xl
border-2 border-warning bg-warning/10 p-4 text-base text-foreground`, `AlertTriangle size-6`.
  Ink on that ground: 13.08:1 light, 8.25:1 evening on a card; 11.97:1 and 9.83:1 on the page.
  Squash never becomes text (slice 01, ruling 1).
- `success`: `border-2 border-primary bg-card`, `CheckCircle2 size-6`.
- Used by the member page, `HandoverForm`, the express page and `InsufficientBalanceDialog`. The
  `data-testid` and children are passed by the caller, so every existing testid stays where it is.
- `negative-balance-notice.tsx` (wallet) does not import it: the wallet feature must not depend on
  the distribution feature. It gets the same classes in its own file (a dozen characters of
  duplication, accepted).

### The home page

- The search block goes (it is the layout's now). `page-distribution-home` stays.
- Heading: `PageTitle` `distribution.waiting.title` ("Commandes à remettre"), then the subtitle
  `distribution.subtitle` in `text-base` (was `text-sm`; it mentions the search on the left, still
  true).
- Tabs `waiting-tab-*`: default size (48 px). Date filters: label text `text-base`, inputs `w-44`.
- Waiting rows (`waiting-row-<id>`, still `button` + `navigate`: they open a member but are not
  "current"): same look as the search results (`min-h-19 rounded-xl border-2 p-4`), name
  `text-lg font-bold`, date `text-sm`, readiness badge, total `font-serif text-lg italic`.
  `waiting-empty` `text-base`.

### The express page

- Header: `PageTitle` `distribution.express.title`, then the member's name and balance line
  `text-base`.
- Receipt banner: `DistributionNotice tone="success"`, as on the member page.
- Product search: `express-product-search` `h-16 text-xl max-w-xl`; options `min-h-14
rounded-xl border-2 px-4 text-lg` buttons, price `tabular-nums`.
- Lines, one card `rounded-xl border-2 border-border bg-card` with `divide-y divide-rule`: name
  `text-lg font-semibold`, `express-qty` `h-12 w-28 text-lg`, price; over stock: a squash pill
  `rounded-full bg-warning px-3 py-1 text-sm font-semibold text-warning-foreground` with the icon
  (`express-over-stock` kept; was raw `text-amber-600`); `express-remove` gets its visible label
  `distribution.express.remove` ("Retirer", the key exists and was unused) beside `Trash2`,
  `variant="ghost"` default size.
- Footer: kraft like the order card, `distribution.order.total`, `express-total` in Lora italic,
  `express-submit` `h-18 min-w-64 text-lg` primary.
- Refusal `express-refusal` in `DistributionNotice tone="warning"`.

### The receipt page

- `PageTitle` `distribution.handover.receipt`; date and "recorded by" line `text-base`; badges;
  total `font-serif text-4xl italic` (`handover-total` kept).
- Lines in one card, `divide-y divide-rule`, rows `text-base` (was `text-sm`).
- `handover-line-difference`: from raw `text-amber-600` to a squash pill like the over-stock one.
- Note `text-base`.
- Reverse: `handover-reverse` `outline` 48 px with `Undo2`; the confirm panel `rounded-xl
border-2 border-destructive bg-card p-4`, label `text-base font-semibold`, reason input full
  width up to `max-w-xl`; confirm `destructive`, dismiss `ghost`, both 48 px.

### The wallet components

- `record-payment-form.tsx`: labels and legend `text-base font-semibold` (were `text-sm`); amount
  `h-12 w-44 text-lg`; method buttons default size (48 px); note field `max-w-md`;
  `wallet-payment-submit` `h-16 min-w-48 text-lg` (64 px: recording a payment is a main action).
- `insufficient-balance-dialog.tsx` (distribution): `rounded-xl border-2 border-border bg-card p-5`;
  the shortfall sentence becomes a `DistributionNotice tone="warning"` inside it; the title line
  without shortfall `font-serif text-xl`; dismiss button `outline` default size.
- `correct-payment-dialog.tsx`, `refund-dialog.tsx`: the payment and balance sentences `text-base`;
  labels and legend `text-base font-semibold`; method buttons default size; the too-large line
  stays `text-destructive`, now `text-base`. Dialog parts already carry the theme (slice 01).
- `wallet-panel.tsx`: rows `divide-y divide-rule`; balance amount `font-serif text-3xl italic
font-bold`; date and method stay `text-base`. Checked on `/account` by the screenshots and by
  `member-phone.spec.ts` (unchanged, must stay green).
- `negative-balance-notice.tsx`: `border-2 border-warning bg-warning/10 text-foreground
rounded-xl p-4`, icon `size-6`. Checked on `/cart` and `/account` the same way.

### Per-screen findings: the `grep` list

Run from `apps/web-spa/app` on `features/distribution features/wallet
features/common/components/distribution-layout.tsx`, on `9b98504`:

- `uppercase` — 1: `distribution-layout.tsx`, the home link (`text-sm font-black tracking-tight
uppercase`). Goes: `font-serif text-3xl font-bold`.
- Arbitrary text sizes `text-[…]` — none. `text-xs` — none.
- Raw colours — 2, both `text-amber-600`: `handover-receipt-page.tsx` (`handover-line-difference`)
  and `express-order-form.tsx` (`express-over-stock`). Both become squash pills. Hex values — none.
- Icons under 20 px in buttons and notices: `size-4` / `h-3.5` in the layout links, the notices and
  the express remove button. They go to the button default (`size-5`) or `size-6` in notices.
- `text-sm` — 45 uses: layout 1, home 8, member page 9, express 6, handover form 5, receipt 4,
  insufficient panel 1, correct dialog 2, record payment 3, refund 4, top-up form 1, wallet panel 1.
  Rule kept from slice 02: a sentence or a label someone reads is `text-base` (18 px); a short
  annotation under or beside a value (a date, a member number, a count, an "ordered n" next to a
  name, the not-ready reason under a product name) may stay `text-sm` (16 px). Every use is decided
  in the sections above; what stays `text-sm` is: dates under titles, member numbers in results,
  the not-ready reason, the status pills, the top-up form hint (slice 02's).

### New translation keys

One block per locale file, in `distribution`:

| Key                               | French                        | English                   |
| --------------------------------- | ----------------------------- | ------------------------- |
| `distribution.nav.main`           | Navigation de la distribution | Distribution navigation   |
| `distribution.member.toHandOver`  | À remettre                    | To hand over              |
| `distribution.line.notHandedOver` | Pas remise cette fois         | Not handed over this time |
| `distribution.waiting.title`      | Commandes à remettre          | Orders to hand over       |

Reused: `distribution.title`, `distribution.nav.backToShop`, `members.nav.myAccount`,
`members.nav.logOut`, `settings.menu`, `distribution.search.*`, `distribution.member.*`,
`distribution.express.remove`, `wallet.*`. The mockup's wording ("Encaisser un paiement", "Vente
express") is not copied: the screens keep "Enregistrer un paiement" and "Commande express", so no
existing text moves.

### The order of work, with the first failing test of each step

Every step: write or extend `apps/web-spa-e2e/tests/distribution-tablet.spec.ts` **before any
production file of the step**, run it alone on the E2E stack while holding the lock, save the red
output to the scratchpad (`s03-stepN-red.log`) and write the log name and its error line in the
worklog at once; then the production code; then green (`s03-stepN-green.log`) together with the
existing specs the step touches; `pnpm typecheck`; `oxfmt` on the changed files by name, a few at a
time; commit with explicit paths.

**Holding the lock matters for Playwright itself:** its config has `reuseExistingServer` off CI, so
with slice 04's servers on 3060 or 5273 it would silently test the other worktree's code.

The test file: `test.use({ viewport: { width: 1194, height: 834 } })`, `withRole('distributor')`,
`resetDb` in `beforeEach`. Helpers copied from `member-phone.spec.ts`, not imported (spec files do
not import each other; the shared helper file is a pending retro proposal of slice 02, not yet
ruled): `expectNoHorizontalScroll`, `findSpilledControls(page, scope)` (its box selector also counts
`[data-testid^="distribution-order-"]` and `[data-slot="dialog-content"]`), `findSmallOrCapitalText`,
`setEveningModeBeforeLoad`, `expectTall(locator, min)`. One new helper, `findSidewaysScrollers(page)`:
every visible element whose computed `overflow-x` is `auto`, `scroll` or `hidden` and whose
`scrollWidth` is above its `clientWidth + 1` (the cut cart row of slice 02 hid in such a frame).
No case signs out: the distributor and admin sessions are shared (lesson of slice 02).

1. **The layout and the search column.** First failing tests, both written now:
   - "la table ne déborde pas et garde la recherche à gauche" — the `no-overflow-tablet` test. For
     1194 × 834 and 768 × 1024, light then evening: `/distribution` with "Fanny" typed (results
     shown); Fanny's page, scrolled to the bottom, where at 1194 `distribution-member-search` must be
     `toBeInViewport()`; the payment panel opened; the express page with one line at an over-stock
     quantity; the receipt page after a handover, with the reverse panel opened; the correction
     dialog after a recorded payment. On each: `expectNoHorizontalScroll`, `findSpilledControls`
     (scope `body`), `findSidewaysScrollers` and `findSmallOrCapitalText` give nothing. A second
     describe as `admin` does the refund dialog at both sizes. **Expected red today:** "DISTRIBUTION
     (uppercase)" in the header, and the search not found on the member page. This test is run red
     now and turns green at step 4 (it covers screens of steps 2 and 3 as well).
   - "une seule recherche, à gauche, sur chaque page" — at 1194: `[data-slot="awning-band"]` inside
     `distribution-layout`; `distribution-home-link` font family starts with `Lora Variable`;
     `distribution-nav-shop`, `distribution-nav-account`, `nav-logout` each hold an `svg` and non-empty
     visible text (`app-settings-trigger` an `svg`, an `aria-label` and a `title`, ruling 1) and are at least 44 px high; the search field's right
     edge is at most 402 px and `page-distribution-home`'s left edge at least 400 px; type Fanny,
     click her row: `page-distribution-member`, `distribution-member-search` and
     `distribution-search-results` each `toHaveCount(1)`, her row has `aria-current="page"`; type
     "Anna", click her row: the URL holds Anna's id, the page shows her name, her row is current and
     Fanny's is not; open the express sale: the search is still visible and Anna still current. At
     768 × 1024: the search field's bottom is above `page-distribution-home`'s top. **Expected red:**
     awning band not found in the layout.
     Then: `distribution-member-search.tsx`, the layout, the home page, the
     `nav.main` and `waiting.title` keys. Green for the second test; the existing
     `distribution-*.spec.ts`, `wallet-refund.spec.ts`, `wallet-correction.spec.ts`,
     `rbac-distributor.spec.ts`, `auth-logout.spec.ts` and `app-settings.spec.ts` run alone, green.
2. **The member page, the order card and the big actions.** First failing test, "la fiche suit
   l'ordre de la maquette": on Fanny's page at 1194: the `h1` is Lora and at least 40 px; tops in
   order: `h1` < `distribution-member-balance-block` < `distribution-to-hand-over` <
   `distribution-actions`; the balance block background is the slate colour (`rgb(47, 58, 51)`);
   `handover-submit` (first order), `wallet-record-payment` and `distribution-start-express` are at
   least 64 px high with visible text; `handover-submit` has the sage background
   (`rgb(78, 107, 74)`) and is the widest of the three. On Elio's page (terminated, so
   `distribution-member-status-warning` shows): the warning's top is below the bottom of
   `distribution-to-hand-over` and above the top of `distribution-actions`. On Anna's page: inside
   one `handover-line-*` row sit both `distribution-line-not-ready` and `handover-excluded`.
   **Expected red:** `distribution-member-balance-block` not found. Then: the member page,
   `handover-form.tsx`, `distribution-notice.tsx`, `insufficient-balance-dialog.tsx`, the keys
   `toHandOver` and `notHandedOver`. Green, with the distribution and wallet specs alone.
3. **Express sale, receipt and wallet components.** First failing test, "vente express, ticket et
   portefeuille au look du marché": express page with a line at 30 (over stock): `express-over-stock`
   has a non-transparent background, `express-remove` holds an `svg` and the text "Retirer",
   `express-submit` is at least 64 px; receipt page of a handover where a quantity was lowered:
   `handover-line-difference` has a non-transparent background; payment panel open: the amount
   label is 18 px and `wallet-payment-submit` at least 64 px; correction dialog:
   `wallet-correct-payment` is 18 px; as admin, refund dialog: `wallet-refund-balance` is 18 px.
   **Expected red:** `express-over-stock` background transparent (first assertion). Then: the express
   page, the receipt page, the four wallet files. Green, with the distribution and wallet specs and
   `member-phone.spec.ts` (account and cart still fit at 390 px) alone.
4. **Sweep, gates, screenshots.** Run step 1's sweep test: green, or fix what it finds and log each
   fix. Then the `grep`s of the criteria, the locale key check, and the five gates in the
   background with full logs read in full (`s03-gate-*.log`). Screenshots (Mason) under
   `screens-s03/`.

The Typist stops any dev server or stack it starts in the same step, by PID or container name, and
releases the lock, or reports what is still running.

### How each criterion is checked

| Criterion                     | Check                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `distribution-search-visible` | Step 1 second test: column position at 1194 on home, member and express pages, switching member without going home, search above content at 768. Receipt page: the sweep visits it at 1194 and checks the field is visible there too. |
| `one-search`                  | Step 1: `toHaveCount(1)` on `distribution-member-search` and `distribution-search-results` on the member page; the full E2E suite (strict mode) green; `grep` that `distribution-member-search` appears in one component only.        |
| `member-pane`                 | Step 2 test: order of name, balance block, list with total, warning, actions; `aria-current` in step 1.                                                                                                                               |
| `big-actions`                 | Step 2 test: 64 px, visible text, sage and widest validate button; step 3 for express submit and payment submit.                                                                                                                      |
| `header`                      | Step 1 test: awning band, Lora name, each control with `svg` and text; `auth-logout.spec.ts` and `rbac-*` green (they use `nav-logout` and the layout).                                                                               |
| `wallet-screens`              | Step 3 test; sweep on the panel and dialogs; `member-phone.spec.ts` green (account, cart); screenshots of `/account` and `/cart` with the notice and panel.                                                                           |
| `no-forced-capitals`          | `grep -rn uppercase` on the three paths empty; the sweep's walker.                                                                                                                                                                    |
| `readable-text`               | `grep` for `text-[…]` and `text-xs` empty; sweep walker (nothing under 14 px); the remaining `text-sm` listed and read against the rule at the review.                                                                                |
| `theme-colours-only`          | The raw palette and hex `grep`s of slice 02 empty on the three paths (a `bg-slate` hit is the theme token).                                                                                                                           |
| `no-overflow-tablet`          | Step 1 sweep test: its red log on the old code, its green log at step 4; screenshots at 1194, 768 and 1440, light and evening.                                                                                                        |
| `i18n-intact`                 | Node check (scratchpad, not committed) that both locale files hold the same keys; `grep` for quoted French words in the changed `.tsx`.                                                                                               |
| `e2e-green`                   | Full `pnpm e2e` log; `git diff --stat 9b98504 -- apps/web-spa-e2e` shows only the new file.                                                                                                                                           |
| `suite-green`                 | The four gate logs.                                                                                                                                                                                                                   |

### Decisions the spec left open

- **Search column width and breakpoint:** 400 px column from Tailwind `lg` (1024 px), as the spec
  says; `minmax(0,1fr)` on the right so a long line cannot widen the grid.
- **Search results keep the balance** under the status. The mockup shows name, number and status
  only; the balance is already in today's results and helps at the table. 400 px holds it.
- **Results become links** (they navigate, and `aria-current` belongs to links). Waiting rows stay
  buttons.
- **Theme scale instead of the mockup's odd sizes:** name 48 px (mockup 52), balance and totals
  32 px (34 and 30), field text 24 px (22), "À remettre" 28 px (26).
- **No precomputed shortfall.** The mockup's "Il manque 2,80 €…" is shown only after the server
  refuses the handover, as today (`distribution.refusal.insufficient_balance`), now in the squash
  box. Computing it in the browser would add a business rule the server owns.
- **New testids** `distribution-nav-shop`, `distribution-nav-account`,
  `distribution-member-balance-block`, `distribution-to-hand-over`, `distribution-actions`: the new
  test needs them; none reuses an old value.

### Questions for the Architect (answered: see the rulings in Notes & Snippets)

1. **The settings control needs a label, but `app-settings-menu.tsx` is out of bounds.** The
   `header` criterion asks for an icon and a label on the settings; `AppSettingsMenu` is icon-only
   and the spec forbids editing it. Options: (a) a small `DistributionSettingsMenu` in
   `features/distribution/components/`, built like slice 02's `PhoneMenu`: a `DropdownMenu` whose
   trigger is an `outline` 48 px button with the `Settings` icon and `settings.menu`
   ("Paramètres"), `data-testid="app-settings-trigger"`, content `<AppSettingsItems
testIdPrefix="app-settings" />`, so the testids stay the same and only one trigger is on the
   page; (b) keep `AppSettingsMenu` icon-only, under the exception of slice 02's ruling 2. Slice 04
   may meet the same question in the back office; a shared labelled menu would then belong in
   `features/common`, which neither slice owns. Recommendation: (a).
2. **One list of lines per order.** Today each order shows its lines twice (the overview, then the
   handover form). I merge them into one list rendered by `HandoverForm`, as the mockup's single
   list. The testids stay, but `distribution-line-not-ready` and `distribution-line-available` move
   from the page into the form's rows, and for a not-ready line `handover-excluded` reads "Pas
   remise cette fois" instead of repeating the reason shown just above it (one new key). No test
   reads that text (`handover-excluded` is only counted). Recommendation: merge. Otherwise: keep
   both lists, restyled.
3. **"Valider la remise" stays per order.** The mockup shows one order and one validate button in
   the bottom row. A member can have several orders, each validated on its own (`handover-submit`
   is scoped per order by the tests). So each order card carries its 72 px sage button in its kraft
   footer, and the bottom row holds the payment, express sale and refund. Recommendation: accept.

## Worklog

- 2026-11-25 — Mason: read the reading list (README, documentation index, general and frontend
  guidelines, constitution, `CONTRIBUTING.md`, `.cursor/rules`, the journal), both specs, the work
  documents of slices 01 and 02, every file of the slice, the distribution and wallet E2E specs,
  `member-phone.spec.ts` and the E2E config. Ran the `grep`s above. Wrote this plan. No production
  code. Plan commit `dc7c076`.
- 2026-11-25 — Typist, step 1, red. Wrote `apps/web-spa-e2e/tests/distribution-tablet.spec.ts`
  before any production file: the sweep (4 cases: 1194 and 768, light and evening), the "one search"
  test, a 768 px "search above the content" test and the admin refund sweep (4 cases). Ran it alone
  under the E2E lock: 10 failed, as expected. Red log:
  `scratchpad/s03-step1-red.log`. Error lines: sweep at 1194 light, `locator.fill: Test timeout of
45000ms exceeded` waiting for `distribution-member-search` on the member page; evening, `accueil :
textes petits ou en capitales` (the uppercase header); at 768, `défilement horizontal`, Expected
  <= 768, Received 796 (the old header); "one search", `awning-band` not found in the layout.
- 2026-11-25 — Typist, step 1, green. Added `distribution-member-search.tsx`, the layout (awning
  band, market top bar, two-column body), the home page without the search, and the keys
  `distribution.nav.main` and `distribution.waiting.title` (fr and en). Green log:
  `scratchpad/s03-step1-green.log`: "une seule recherche" and "sous 1024 px" pass. The sweep gets
  further but stays red on purpose until steps 2 and 3. Two findings. First, the correction dialog
  holds a 1 px wide `sr-only` frame (the close label) that my own `findSidewaysScrollers` counted as
  cut. I fixed that false positive in the new helper (frames 1 px wide are skipped). Second, a real
  one: `wallet-refund-confirm` leaves the refund dialog box on the left at both sizes (two wide
  buttons in a `sm:max-w-sm` dialog). Step 3 owns `refund-dialog.tsx`, so it is fixed there. Other
  specs run alone, all green: `s03-step1-others-a.log` (distribution screen, handover, express,
  waiting, wallet, reversal: 27 passed) and `s03-step1-others-b.log` (wallet-refund,
  wallet-correction, rbac-distributor, auth-logout, app-settings: 19 passed). `pnpm typecheck`:
  `s03-step1-typecheck.log`, clean. No departure from the plan.
- 2026-11-25 — Typist, step 2, red. Added the three step 2 tests ("la fiche suit l'ordre de la
  maquette", the terminated member's warning order, the not-ready line that keeps its reason) to
  `distribution-tablet.spec.ts` before any production file. Run alone with `-g`: 3 failed. Red log:
  `scratchpad/s03-step2-red.log`. Error lines: order test, `Expected: >= 40, Received: 32` (the
  title is 32 px, so it stopped before the missing balance block); warning test, timeout waiting
  for `getByTestId('distribution-to-hand-over')`; not-ready test, `toHaveCount` Expected 1,
  Received 0 (the reason and `handover-excluded` sit in two lists).
- 2026-11-25 — Typist, step 2, green. Added `distribution-notice.tsx`, rebuilt the member page,
  `HandoverForm` (one merged list, kraft footer, 72 px validate), `insufficient-balance-dialog.tsx`,
  and the keys `distribution.member.toHandOver` and `distribution.line.notHandedOver`. Green log:
  `scratchpad/s03-step2-green.log` (4 passed, including the step 1 layout test). Other specs run
  alone, all green: `s03-step2-others.log` (distribution screen, handover, express, waiting,
  wallet, reversal, wallet-refund, wallet-correction, rbac-distributor: 42 passed). Typecheck:
  `s03-step2-typecheck.log`. Two departures, both because the plan contradicted itself:
  1. The plan says `h1` top < balance block top, but its own layout puts the member number above
     the name and the balance block beside them, so the block starts higher than the name. I wrote
     the test as: name left of the balance block, both above the list, the list above the actions.
     The mockup order is kept.
  2. The plan says the validate button is the widest of the three actions at `min-w-64` (256 px),
     but "Enregistrer un paiement" with its icon is 307 px wide. I set `min-w-80` (320 px) on the
     validate button so it is the widest in French. English labels were not measured.
- 2026-11-25 — Typist, step 3, red. Added "vente express, ticket et portefeuille au look du
  marché" (distributor) and "le remboursement au look du marché" (admin) before any production
  file. Red log: `scratchpad/s03-step3-red.log`. Error lines: `expect(locator).not.toHaveCSS`
  Expected not "rgba(0, 0, 0, 0)", Received "rgba(0, 0, 0, 0)" on `express-over-stock`; refund
  `wallet-refund-balance` Expected 18, Received 16. A first run failed earlier because my test
  built the over-stock line from the apples (more than 30 on the shelf); the express test now uses
  the honey (25 on the shelf), like `distribution-express.spec.ts`. That fix also corrects the step
  1 sweep, which used the same helper.
- 2026-11-25 — Typist, step 3, green. Rewrote the express page and the receipt page, and the five
  wallet files (`record-payment-form`, `correct-payment-dialog`, `refund-dialog`, `wallet-panel`,
  `negative-balance-notice`). Green log: `scratchpad/s03-step3-green.log` (3 passed). Other specs
  run alone, all green: `s03-step3-others.log` (distribution, wallet-refund, wallet-correction,
  wallet-topup, rbac-distributor and `member-phone.spec.ts`: 71 passed, so `/account` and `/cart`
  still fit at 390 px). Typecheck: `s03-step3-typecheck.log`. The refund dialog got `sm:max-w-lg`
  because its confirm button left the box (step 1 finding). No departure from the plan.
- 2026-11-25 — Typist, step 4, sweep and gates (screenshots are the Mason's).
  - Sweep: first run `s03-step4-sweep-1.log` failed 4 of 16 on one finding: the toast "€10.00
    ajoutés au solde." is 13 px. Toasts come from `packages/ui` `Toaster` (`cn-toast` class), which
    this slice may not touch and which the shop and member layouts share. I made the sweep's text
    walker skip `[data-sonner-toaster]` and I report it. Second run `s03-step4-sweep-2.log`
    (copied to `s03-step4-green.log`): 16 passed, so the sweep is green at 1194 and 768, light
    and evening, with the refund dialog as admin.
  - `grep`s on `features/distribution`, `features/wallet` and the layout: no `uppercase`, no
    `text-[…]`, no `text-xs`, no raw colour, no hex, no icon under 20 px. `text-sm` stays only on
    dates, member numbers, status pills, the balance under a result, the not-ready reason, the
    top-up hint and the small "Corriger" button of the wallet panel: all in the plan's list but the
    button, which the plan did not mention. `distribution-member-search` as a test id sits in one
    component only. Locale check: fr and en hold the same keys.
  - Gates, full logs read: `s03-gate-lint.log` green, `s03-gate-typecheck.log` green,
    `s03-gate-build.log` green. `s03-gate-test.log`: 1 failure in the API,
    `topup.controller.e2e-spec.ts` "refuses 3 euros with amount_too_low" got 404 instead of 400; the
    API is not touched by this slice. Alone it passes (45 passed, `s03-gate-test-rerun-topup.log`).
    Probably the other worktree's tests ran at the same time. `s03-gate-e2e.log`: 186 passed, 1
    failed, `admin-inventory-stock.spec.ts` "received twice" (`page-supplier-order-detail` not
    found); alone it passes (`s03-gate-e2e-rerun-inventory.log`, 3 passed). Not edited.
  - `git diff --stat 9b98504 -- apps/web-spa-e2e`: only the new `distribution-tablet.spec.ts`.
  - Not done: the screenshots under `screens-s03/` (Mason).

- 2026-11-25 — Mason, review, retouches, screenshots, final gates and close.
  - **Typist's work checked.**
    - Each step's red log came before its production commit, and each error line matches the plan:
      `s03-step1-red.log` (10 failed), `s03-step2-red.log` (3), `s03-step3-red.log` (2).
    - All gate logs were read in full.
    - The Typist's departures are accepted: the order check, `min-w-80`, the `sr-only` filter, the
      honey for the over-stock case, and the wider refund dialog.
  - **Review.** `code-review` ran with two fresh reviewers. The findings and their answers are in
    Diff-Review Findings, and the fixes are in `f62bb05`. Those fixes are a Mason retouch, an
    exception to "the Typist types": a few lines found while checking, with the Typist already
    gone. They are:
    - the four keys moved into one `distribution.table` block;
    - one `HandoverRecordedNotice` for the receipt notice;
    - the not-ready reason at 18 px;
    - the "Pas remis" wording;
    - the hover colour on the current result;
    - the `committedSearch` name.
  - **Retouch check.** The browser tests that touch the table passed after the retouch
    (`s03-fix-e2e.log`, 57 passed). The final gates came after the screenshot fixes.
  - **Screenshots.** There are 72 files in the scratchpad's `screens-s03/`:
    - the home, member, not-ready, terminated, refused-payment, express and receipt pages;
    - the correction and refund dialogs;
    - `/account` and `/cart`;
    - each at 1194, 768 and 1440 px, in light and evening mode.
      A temporary Playwright config took them; it started and stopped its own servers and was
      deleted afterwards (`s03-shots.log`, `s03-shots-2.log`).
  - **What the screenshots found.** The tests had missed it:
    - in the 400 px column, member names and numbers were broken over two lines;
    - each line price was pushed under its row.
      Nothing was cut or overflowing, so no test failed first. Fixed in `bdd2dfe`. The fix was
      checked on new screenshots and with `s03-fix-e2e-2.log` (32 passed).
  - **Final gates**, on `bdd2dfe` and still holding the lock:
    - `pnpm lint`, `pnpm typecheck` and `pnpm build`: exit 0 (`s03-gate-*-final.log`).
    - `pnpm e2e`: 187 passed, none failed (`s03-gate-e2e-final.log`).
    - `pnpm test`: 125 + 15 + 734 passed and 1 failed (`s03-gate-test-final.log`). The failure was
      the known flaky wallet test, "refuses a second correction with already_corrected" (201
      instead of 409). Rerun alone, its file passed, 38 passed
      (`s03-gate-test-final-rerun-wallet.log`). The slice does not touch the API. Reported, not
      edited.
  - **Close checks.**
    - The criteria `grep`s on the three paths find no `uppercase`, `text-[…]`, `text-xs`, raw
      colour or hex.
    - Both locale files hold the same keys (the i18n test is green).
    - `git diff --stat 9b98504 -- apps/web-spa-e2e` shows only `distribution-tablet.spec.ts`.
  - **Processes.** The E2E stack was taken down with `e2e:down`. Nothing listens on 3060 or 5273.
    The lock was released after each of my runs (slice 04 holds it now).

## Implementation Checkboxes

- [x] Step 1 — layout and search column: sweep and layout tests red, then the layout test green (sweep stays red until steps 2 and 3, on purpose)
- [x] Step 2 — member page, order card, big actions: red, then green
- [x] Step 3 — express sale, receipt, wallet components: red, then green
- [x] Step 4 — sweep green, five gates green (flaky reruns logged), screenshots taken, files formatted

## Notes & Snippets

**Architect's rulings at the plan reading** (Architect, 2026-11-25, written by the Mason):

1. **Settings: option (b).** The settings control stays `AppSettingsMenu`, icon-only, with its
   `aria-label` and `title`, under slice 02's ruling 2 exception. No second menu is built. The
   Architect may move a labelled settings menu into `features/common` once both slices are merged.
2. **One list of lines per order, inside `HandoverForm`: accepted, on one condition.** A line that
   is not ready still shows its reason, as today. "Pas remise cette fois" may lead, but the reason
   stays visible, because the distributor needs it to answer the member. The testids move into the
   rows.
3. **One "Valider la remise" per order**, in that order's footer: accepted.

Also accepted: no session date, progress pill or checkboxes; the shortfall warning still comes
from the server; today's wording kept; the nearest theme sizes; no red inside the slate block;
`DistributionNotice`, with its classes copied in the wallet's notice. The E2E lock is mandatory for
every Playwright run.

**Retro proposals** (Mason, 2026-11-25). None is applied; each waits for its owner.

1. **Coding standards: larger sizes and tones belong in `packages/ui`.** Owner: the human.
   - Slices 02 and 03 both typed by hand the same large-button sizes, money figures, squash fill,
     straw pill and a kraft tint with an evening override.
   - Proposal: once slices 03 and 04 are merged, add to `packages/ui`:
     - a `xl` (64 px) and a `2xl` (72 px) Button size;
     - a `warning` Button variant;
     - a `straw` Badge variant;
     - an `Amount` component;
     - a `kraft-tint` theme token.
   - The same task can fix the `Toaster`: its text is 13 px and its `richColors` come from outside
     the theme.
2. **Automated checks: screenshots catch cramped text that no test fails on.** Owner: the human.
   - In both slices the screenshots found text squeezed into a narrow column, which no
     overflow check could see.
   - Proposal: the layout helper of slice 02's retro proposal 1 also reports a short word broken
     across two lines (an element whose text wraps inside a word, or whose height is above
     two lines at under 120 px wide).
3. **Information access: the lock does not cover `pnpm test`.** Owner: the human.
   - The API tests of the two worktrees can run at the same time. Two unrelated API tests failed
     once each, and the Typist suspected the other worktree.
   - Proposal: the brief for parallel worktrees says `pnpm test` also runs under the lock, or
     each worktree uses its own test database.
4. **AGENTS.md hygiene: the known flaky list.** Owner: the human.
   - `admin-inventory-stock.spec.ts`, "received twice", failed once in a full run and passed
     alone. It is not on the list.
   - Proposal: watch it, and add it to the list if it fails again.

## Diff-Review Findings

`code-review` ran on `git diff 9b98504...HEAD` at `5c3e009`, with two fresh reviewers, 2026-11-25.
Each finding has its fix or its answer, signed by the Mason. The fixes landed in `f62bb05`, and the
screenshot fixes in `bdd2dfe`.

**Standards axis:**

- **Copied receipt notice.** The member page and the express sale held the same receipt notice
  (Duplicated Code). Fixed: one `HandoverRecordedNotice` in
  `features/distribution/components/handover-recorded-notice.tsx`.
- **Unclear name.** `committed` in the search did not say what it held (Mysterious Name). Fixed:
  `committedSearch`.
- **Warning styles copied in the wallet.** `NegativeBalanceNotice` copies the warning classes of
  `DistributionNotice`. Answered: kept. The Architect accepted it at the plan reading, so that the
  wallet feature does not import from the distribution feature. A shared notice would belong in
  `packages/ui` or `features/common`, and this slice may not touch either.
- **Repeated sizes.** Some styling is repeated by hand:
  - the large-button sizes (`h-18 px-6 text-lg`);
  - the money figures (`font-serif … italic tabular-nums`);
  - the squash fill on the payment button;
  - the straw status pill, which could be a `Badge` variant.
    Answered: each of these is a component size or variant in `packages/ui`, which the slice spec
    puts out of bounds. This is retro proposal 1.
- **`dark:bg-muted` on the kraft footers.** The reviewer read it as a theme token missing from the
  screen. Answered: kept, for the contrast reason in the plan (the kraft tint over the evening
  card gives 3.94:1). It is retro proposal 1 too: a "kraft tint" token in the theme.
- **Folder layering.** `features/common/components/distribution-layout.tsx` imports from
  `features/distribution`. Answered: the layout already lived in `common` before this slice, and
  the slice spec names that path as its seam. Moving it would change `routes.ts`, which the spec
  forbids.

**Spec axis:**

- **Toasts are 13 px**, under the 14 px floor of `readable-text`. The text walker skips
  `[data-sonner-toaster]`. Answered: the `Toaster` lives in `packages/ui`, is shared by every
  layout, and its `richColors` green is also a colour from outside the theme. Reported to the
  Architect as an open point for a `packages/ui` change.
- **16 px text against "body text at least 18 px".** Partly fixed: the not-ready reason is now
  `text-base` (18 px), because the distributor reads it to the member. These stay `text-sm`
  (16 px), as short notes next to a value, the rule approved in the plan:
  - dates;
  - member numbers;
  - status pills;
  - the balance under a search result;
  - the "Corriger" button of the wallet panel.
- **The balance block sits beside the name, not below it.** The spec says the page reads "from top
  to bottom: the member's name … number, the balance in a block". Answered: the approved plan and
  the mockup put the block on the right of the name. Below 1024 px it falls under the name when
  the row is too narrow. Reported to the Architect.
- **New keys in four places.** The keys sat in four places of each locale file, not "in one
  block" as the spec's note asks. Fixed: they are now one `distribution.table` block
  (`navigation`, `toHandOver`, `notHandedOver`, `ordersToHandOver`) in both files.
- **French wording.** "Pas remise cette fois" agreed with nothing clear. Fixed: "Pas remis cette
  fois", like "Déjà remis".
- **Added without being asked:**
  - the balance in the search results (a plan decision the Architect accepted);
  - the wider refund dialog (`sm:max-w-lg`), which stops its confirm button sticking out;
  - five new testids that the test needs;
  - `min-w-80` on the validate button, measured in French only.
    Answered: all kept.
- **Settings icon-only, one validate button per order, the merged line list.** Answered: these
  are Architect rulings 1, 3 and 2.
