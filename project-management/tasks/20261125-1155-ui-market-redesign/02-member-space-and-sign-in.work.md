# 02 — Member space and sign-in — work

Created by the Mason at the plan step, 2026-11-25. Spec:
`project-management/tasks/20261125-1155-ui-market-redesign/02-member-space-and-sign-in.spec.md`.
The parent spec, with the owner's decisions, is
`project-management/tasks/20261125-1155-ui-market-redesign.spec.md`. The theme tokens, the
`AwningBand` component and the browser test `market-theme.spec.ts` come from slice 01; its work
document is `01-theme-and-shared-components.work.md` in this folder.

**Plan:** approved by the Architect, 2026-11-25, with the rulings in Notes & Snippets.

## Program Design

### What changes, in one paragraph

The shop and the member area get one shared shell: the awning band, the top bar, the page, a new
tab bar fixed at the bottom on phones, and the toasts. The top bar shows its current links from
768 px up, and on phones shows only the app name and one "Menu" button. The tab bar and the
phone menu are new components with their own `data-testid` values. The screens of the shop, cart,
account, wallet and participation lose their forced capitals, their raw colours and their
too-small body text, and the shop cards and the cart table stop overflowing at 390 px. The sign-in
pages get the "Grocery" name in Lora, the awning band and a market-style side panel. Routes,
guards, API calls, journeys and existing `data-testid` values do not move. One new browser test
file, written first and step by step, proves it at 390 px and checks the desktop at 768 and
1440 px. No existing test is edited.

### How one navigation or the other is shown: CSS breakpoints

The tab bar carries `md:hidden`; the desktop links of the top bar sit in a `hidden md:flex`
group; the phone "Menu" button sits in a `md:hidden` group. Tailwind's `md` is exactly 768 px,
the spec's threshold. Both navigations are always in the DOM, and only CSS decides which one shows.

Why CSS and not a media-query hook:

- **No flash and no wrong first paint.** A hook only knows the width after it runs. The
  `useIsMobile` hook of `packages/ui` starts at `false` and corrects itself in an effect, so a phone
  would first paint the desktop bar and then swap. CSS is right on the first frame and needs no
  resize listener.
- **The locator risk is handled by the testids, not by the DOM.** A hidden element still matches
  `getByTestId`, so the tab bar and the phone menu never reuse a desktop testid (see below), and
  Playwright's strict mode never sees two matches. `getByRole` and `getByLabel` skip elements
  under `display: none`, so they match one element too. `getByText` does not skip them. I searched
  the E2E suite: no test calls `getByText` on a navigation label ("Panier", "Participation", "Mon
  compte", "Se connecter", "Se déconnecter", "Admin"). A future test that does must scope its
  locator, and the closing journal entry says so.
- **The other screens already work this way.** The shop's category rail is a `hidden lg:block`
  aside beside a `lg:hidden` sheet trigger.

The same rule holds for the cart table: one markup, restyled by `max-md:` classes. Duplicating the
cart lines for phones would duplicate `cart-line-*` testids and break strict mode at 1440 px.

### Files

| File                                                                                                                                     | Change                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web-spa-e2e/tests/member-phone.spec.ts`                                                                                            | New browser test, grown step by step (see "The order of work").                                                                                                                                                  |
| `apps/web-spa/app/features/common/components/member-shell.tsx`                                                                           | New. The chrome shared by the shop and member area layouts.                                                                                                                                                      |
| `apps/web-spa/app/features/common/components/member-tab-bar.tsx`                                                                         | New. The phone tab bar.                                                                                                                                                                                          |
| `apps/web-spa/app/features/common/components/phone-menu.tsx`                                                                             | New. The phone "Menu" dropdown.                                                                                                                                                                                  |
| `apps/web-spa/app/features/common/components/app-settings-items.tsx`                                                                     | New. The theme and language items, taken out of `app-settings-menu.tsx` so the phone menu shows the same items with its own testids.                                                                             |
| `apps/web-spa/app/features/common/components/app-settings-menu.tsx`                                                                      | Renders `AppSettingsItems` with the prefix `app-settings`; trigger grows from 36 to 44 px. Testids unchanged. The back office and distribution layouts use it too: they get the bigger trigger and nothing else. |
| `apps/web-spa/app/features/common/components/site-header.tsx`                                                                            | Split into a phone group and a desktop group; `nav` landmark; sign-in gets an icon; wraps instead of overflowing between 768 and about 920 px. No more `uppercase`.                                              |
| `apps/web-spa/app/features/common/components/shop-layout.tsx`                                                                            | Renders `MemberShell` with the shop width. No guard here today, none added.                                                                                                                                      |
| `apps/web-spa/app/features/common/components/member-area-layout.tsx`                                                                     | Keeps its guard and redirect as they are, then renders `MemberShell` with the member width.                                                                                                                      |
| `apps/web-spa/app/root.tsx`                                                                                                              | Viewport meta gets `viewport-fit=cover`; `body` gets left and right safe-area padding (see "Safe area").                                                                                                         |
| `apps/web-spa/app/features/auth/components/auth-layout.tsx`                                                                              | Awning band, "Grocery" name in Lora instead of the anvil logo, market side panel.                                                                                                                                |
| `apps/web-spa/app/features/auth/components/auth-page-header.tsx`                                                                         | Title `font-serif text-4xl`, description `text-lg`.                                                                                                                                                              |
| `apps/web-spa/app/features/auth/pages/*.tsx`, `auth/forms/*.tsx`                                                                         | Raw red goes, error boxes grow with their text, text links become 48 px link buttons. Listed below.                                                                                                              |
| `apps/web-spa/app/features/shop/components/*.tsx`                                                                                        | Product card, grid, category rail, shop page, product page, stock notice. Listed below.                                                                                                                          |
| `apps/web-spa/app/features/cart/components/*.tsx`                                                                                        | Stepper that wraps in narrow cards, quick-add button that wraps, cart table stacked on phones, remove button with a label. Listed below.                                                                         |
| `apps/web-spa/app/features/account/components/account-page.tsx`, `member-qr.tsx`                                                         | No capitals, no `bg-white`, text sizes. Listed below.                                                                                                                                                            |
| `apps/web-spa/app/features/wallet/components/wallet-panel.tsx`, `topup-form.tsx`, `topup-return-page.tsx`, `negative-balance-notice.tsx` | Text sizes and section titles only. The three wallet dialogs and the record-payment form serve the distribution and the back office: they are left to slices 03 and 04.                                          |
| `apps/web-spa/app/features/participation/components/*.tsx`                                                                               | Text sizes and section titles only.                                                                                                                                                                              |
| `apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json`, `en/…en.json`                                                             | The new keys below, in both languages.                                                                                                                                                                           |

`packages/ui` is not edited. Every need below is met with class strings on the existing
components and their unchanged props.

### The shell

```tsx
// features/common/components/member-shell.tsx
/** The chrome of the shop and the member area: awning, top bar, page, phone tab bar, toasts. */
export function MemberShell({
  contentClassName,
  children,
}: {
  contentClassName: string // the width of the page: 'max-w-5xl' for the shop, 'max-w-3xl' for the member area
  children: ReactNode
}): ReactElement
```

Markup, in order:

1. Root `div`: `min-h-svh bg-background`, and two CSS variables set with Tailwind arbitrary
   properties so the page, the tab bar and the toasts agree on one height:
   `[--tab-bar-height:5rem]`,
   `[--page-bottom-space:calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+1.5rem)]`
   below 768 px and `md:[--page-bottom-space:1.5rem]` from 768 px up.
2. `<AwningBand />`.
3. `<SiteHeader />`.
4. `<main className={cn('mx-auto px-4 pt-6 pb-(--page-bottom-space) md:px-6', contentClassName)}>`
   with the children. The bottom padding is what keeps the last line of every page above the tab
   bar.
5. `<MemberTabBar />`.
6. `<Toaster position="bottom-right" richColors offset={{ bottom: 'var(--page-bottom-space)' }}
mobileOffset={{ bottom: 'var(--page-bottom-space)' }} />`. Sonner 2.0.7 takes CSS strings for
   both, renders inside the root `div` (no portal), so the variable resolves. Sonner switches to
   `mobileOffset` under 600 px, our bar shows under 768 px: passing the same value to both covers
   the 600–767 px gap.

`ShopLayout` becomes `<MemberShell contentClassName="max-w-5xl"><Outlet /></MemberShell>`.
`MemberAreaLayout` keeps its `isPending` loader and its `Navigate` guard word for word, then
returns `<MemberShell contentClassName="max-w-3xl"><Outlet /></MemberShell>`.

### Safe area

- `root.tsx` viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover`. Without
  `viewport-fit=cover`, iOS reports every `env(safe-area-inset-*)` as 0, so the spec's home
  indicator rule could not work.
- `cover` lets the page run under the notch in landscape, in every layout (back office and
  distribution too). `body` gets `pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]`
  beside its `bg-gradient-bg`, so nothing goes under the notch. Both are 0 on desktop and Android.
- The tab bar adds `pb-[env(safe-area-inset-bottom)]` under its row of tabs.

Playwright cannot emulate a safe-area inset, so this part is checked by reading the class strings at
the review, and is written as such in the criteria check.

### The tab bar

```tsx
// features/common/components/member-tab-bar.tsx
/** The phone navigation of the shop and the member area, fixed at the bottom under 768 px. */
export function MemberTabBar(): ReactElement
```

- `<nav aria-label={t('shop.nav.mainNavigation')} data-testid="member-tab-bar"
className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">`.
- Inside, one `ul` `grid h-(--tab-bar-height) grid-cols-4` (signed in) or `grid-cols-3` (signed
  out), one `li` per tab, each holding a React Router `NavLink`. `NavLink` writes
  `aria-current="page"` by itself when its path matches, and matches child paths too: `/shop`
  stays current on a product page, `/account` on the top-up return page.
- Each link: `flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold`
  (14 px), at least 64 px high. Its icon (`size-6`, 24 px, `aria-hidden`) sits in a pill
  `relative flex h-8 w-14 items-center justify-center rounded-full`. Current tab: pill
  `bg-primary text-primary-foreground`, label `text-foreground`. Other tabs: pill transparent, icon
  and label `text-muted-foreground` (7.45:1 on the light card, 5.93:1 on the evening card).
  `NavLink`'s `className` function gives the two states. The label is a `span` with
  `max-w-full truncate px-1`: "Participation" at 14 px is about 90 px, the column is 97 px at
  390 px, so it fits whole; `truncate` only protects a much longer translation.
- Cart count, shown when the count is above 0: a `span` `absolute -top-1 right-1 min-w-6 h-6
rounded-full bg-warning px-1.5 text-xs leading-6 text-warning-foreground tabular-nums`
  (squash fill with light text, 4.85:1), `data-testid="tab-bar-cart-count"`, plus a screen-reader
  text `sr-only` `t('shop.nav.cartItems', { count })` so the tab reads "Panier, 2 articles".

| Tab (signed in) | Icon           | Label key                         | `to`             | `data-testid`           |
| --------------- | -------------- | --------------------------------- | ---------------- | ----------------------- |
| Shop            | `Store`        | `shop.nav.shop` (exists)          | `/shop`          | `tab-bar-shop`          |
| Cart            | `ShoppingCart` | `shop.nav.cart` (exists)          | `/cart`          | `tab-bar-cart`          |
| Participation   | `CalendarDays` | `participation.nav.participation` | `/participation` | `tab-bar-participation` |
| My account      | `User`         | `shop.nav.myAccount` (exists)     | `/account`       | `tab-bar-account`       |

Signed out: Shop, then Cart to `/login?redirect=%2Fcart` (the same target as the desktop cart
link today), then Sign in (`LogIn` icon, `shop.nav.signIn`, `/login`,
`data-testid="tab-bar-signin"`). The icons match the desktop bar where one exists, so a member who
switches device sees the same picture.

### The top bar

`SiteHeader` keeps its role and its order of controls from 768 px up.

- `header`: `flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-border
bg-card px-4 py-3 md:px-6`.
- App name link: `font-serif text-xl font-bold` (was `text-sm font-black uppercase
tracking-tight`), text still `t('members.title')`, still to `/shop`.
- Phone group, `md:hidden`: `<PhoneMenu isAdmin={isAdmin} isSignedIn={Boolean(sessionData)}
onSignOut={handleLogout} />`.
- Desktop group, `hidden md:flex`: `<nav aria-label={t('shop.nav.mainNavigation')}
className="flex flex-wrap items-center justify-end gap-1">` holding the same controls in the same
  order with the same testids: `AppSettingsMenu`, `site-nav-cart` (+ `site-nav-cart-count`),
  `site-nav-admin`, `site-nav-participation`, `site-nav-account`, `nav-logout`, or
  `site-nav-signin`. Sign-in gains a `LogIn` icon. Icons go from `mr-2 size-4` to the button's own
  `gap-2` and `size-5`, as slice 01 made the default. Only one `nav` is visible at a time, so the
  two landmarks share the name "Navigation principale" without ambiguity.
- Between 768 px and about 920 px the desktop group is wider than the space beside the name: the
  `flex-wrap` on the header and on the `nav` puts it on a second line instead of overflowing. The
  new test checks 768 px.

### The phone menu

```tsx
// features/common/components/phone-menu.tsx
/** The phone "Menu": settings, back office for admins, sign-out. What the tab bar does not hold. */
export function PhoneMenu({
  isAdmin,
  isSignedIn,
  onSignOut,
}: {
  isAdmin: boolean
  isSignedIn: boolean
  onSignOut: () => void
}): ReactElement
```

- A `DropdownMenu` (the one `AppSettingsMenu` uses). Trigger: `Button` `variant="outline"
size="sm"` (44 px) rendered as the menu trigger, `Menu` icon and visible label
  `t('shop.nav.menu')`, `data-testid="phone-menu-trigger"`.
- Content `align="end"`, `w-56`: `<AppSettingsItems testIdPrefix="phone-menu" />` (gives
  `phone-menu-theme`, `phone-menu-lang-fr`, `phone-menu-lang-en`); then, for admins, a separator
  and an item rendered as `<Link to="/admin/members" />`, `ShieldCheck` icon,
  `adminMembers.backOffice`, `data-testid="phone-menu-admin"`; then, when signed in, a separator
  and a sign-out item, `LogOut` icon, `members.nav.logOut`, `data-testid="phone-menu-logout"`.
- `SiteHeader` keeps the one sign-out handler and passes it down, so it is written once.

```tsx
// features/common/components/app-settings-items.tsx
/** The theme switch and the language list, shared by the settings menu and the phone menu. */
export function AppSettingsItems({ testIdPrefix }: { testIdPrefix: string }): ReactElement
```

It holds today's items of `AppSettingsMenu` unchanged, with `data-testid={`${testIdPrefix}-theme`}`
and `${testIdPrefix}-lang-${key}`. `AppSettingsMenu`passes`app-settings`, so its rendered testids
are byte for byte today's.

### New translation keys

Both locales, same place, in `common.locales.fr.json` and `common.locales.en.json`:

| Key                        | French                | English         |
| -------------------------- | --------------------- | --------------- |
| `shop.nav.mainNavigation`  | Navigation principale | Main navigation |
| `shop.nav.menu`            | Menu                  | Menu            |
| `shop.nav.cartItems_one`   | {{count}} article     | {{count}} item  |
| `shop.nav.cartItems_other` | {{count}} articles    | {{count}} items |
| `cart.removeLine`          | Retirer               | Remove          |

Reused as they are: `shop.nav.shop`, `shop.nav.cart`, `shop.nav.myAccount`, `shop.nav.signIn`,
`participation.nav.participation`, `adminMembers.backOffice`, `members.nav.logOut`,
`members.title`, `settings.*`, `cart.unitPrice`, `cart.lineTotal`.

### The sign-in layout

`auth-layout.tsx`:

- Root: `flex min-h-svh flex-col bg-background`; first child `<AwningBand />`; then the existing
  two-column grid `grid flex-1 lg:grid-cols-2 md:p-4`.
- Brand: the anvil disc goes. `<Link to="/" data-testid="auth-brand" className="font-serif
text-2xl font-bold">{t('members.title')}</Link>` (the name was a hard-coded "Grocery"; it now
  comes from the existing key).
- Form column: `px-4 py-6`, form width `max-w-sm` kept.
- Side panel, still `hidden lg:flex`: `rounded-xl border-2 border-border bg-card p-10`
  (was `bg-primary/5 backdrop-blur-sm`), `data-testid="auth-aside"`. Title `font-serif`. Body
  `text-base`. Points `text-base`, their check discs `size-6` with a `size-4` icon.

`auth-page-header.tsx`: title `font-serif text-4xl font-semibold text-balance` (48 px Lora is too
wide at 390 px for "Mot de passe oublié"), description `text-lg`.

### Per-screen changes

The search covered every file of `features/shop`, `features/cart`, `features/account`,
`features/wallet`, `features/participation`, `features/auth`, and `site-header.tsx`,
`shop-layout.tsx`, `member-area-layout.tsx`. Commands and results are in Notes & Snippets.

**Forced capitals (4, all go):**

| File and element                                    | Today                                                 | Becomes                                        |
| --------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| `site-header.tsx`, app name                         | `text-sm font-black uppercase tracking-tight`         | `font-serif text-xl font-bold`                 |
| `shop-page.tsx`, category heading in the aside      | `text-xs font-medium tracking-widest uppercase`       | `<SectionTitle className="mb-2 px-2 text-lg">` |
| `account-page.tsx`, field label "name"              | `text-xs font-medium uppercase tracking-widest muted` | `text-base font-semibold text-foreground`      |
| `account-page.tsx`, field labels of the five fields | same                                                  | same as above                                  |

**Text under 14 px:** none. No `text-[…]` size is left in these files, and `text-xs` is 14 px since
slice 01. Nothing to remove.

**Body text to 18 px.** Rule: a sentence the member reads (page subtitle, explanation, empty
state, error, description, notice) is `text-base`. A short annotation under or beside a value (a
count, a date line under a title, a hint under a field, a stock line, a unit) may stay `text-sm`
(16 px) or `text-xs` (14 px). Changed to `text-base`:

- `shop-page.tsx`: subtitle; `shop-count` stays `text-sm`; the "showing x of y" line goes from
  `text-xs` to `text-sm`.
- `shop-product-detail-page.tsx`: load error; description (`shop-product-description`);
  category name stays `text-sm`.
- `cart-page.tsx`: load error; pending-pickup notice list and title (`text-sm` to `text-base`,
  title `font-serif text-lg`); its note from `text-xs` to `text-sm`; the per-line pickup breakdown
  from `text-xs` to `text-sm`.
- `checkout-confirmation.tsx`: dropped-lines box, order lines, next steps.
- `account-page.tsx`: load error, not-active text, end-of-membership warning; the status line
  under the title stays `text-sm`, and gets `flex-wrap` (see overflow).
- `member-qr.tsx`: number `text-base`, hint `text-sm`.
- `wallet-panel.tsx`: empty text; movement rows `text-base`; title becomes `SectionTitle`.
- `topup-form.tsx`: title becomes `SectionTitle`; field label `text-base font-semibold`; error
  `text-base`; hint and note from `text-xs` to `text-sm`.
- `topup-return-page.tsx`: the credited sentence.
- `negative-balance-notice.tsx`: `text-sm` to `text-base`, icon `size-5`.
- `participation-page.tsx`: subtitle, both empty texts; both `h2` become `SectionTitle` (was
  `text-lg font-bold`). `slot-card.tsx` and `my-signup-row.tsx`: role label `text-lg
font-semibold`, date lines stay `text-sm`.
- `auth-*`: error lines, "email sent" text, the bottom links (see links below).

**Raw colours (4, all go):**

| File                                        | Today                  | Becomes                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-login-page.tsx`, error line           | `text-red-500`         | `text-destructive` (6.71:1 light, 5.97:1 evening on the page)                                                                                                                                                                                                 |
| `auth-forgot-password-page.tsx`, error line | `text-red-500`         | `text-destructive`                                                                                                                                                                                                                                            |
| `auth-register-page.tsx`, error line        | `text-red-500`         | `text-destructive`                                                                                                                                                                                                                                            |
| `member-qr.tsx`, QR code                    | `rounded bg-white p-2` | `rounded-lg` and the QR's own `marginSize={2}` for the quiet zone. `QRCodeSVG` (qrcode.react 4.2) paints its own white background (`bgColor` default), so the code stays black on white for scanners in evening mode too, with no colour written in our file. |

No hex value was found. Two softer points that the search does not count as raw colours but the
theme rule covers: the category counts' `text-muted-foreground/70` (a faded muted text, under
4.5:1 at night) becomes `text-muted-foreground`; the category sheet trigger's `border-input
bg-background` becomes `border-2 border-input bg-card`.

**Links and buttons (touch targets and icon-with-label):**

- The plain text links become `Button variant="link"` rendering the router `Link` (48 px, ink
  text with the sage underline of slice 01), testids kept on the same element: `cart-browse-shop`,
  `checkout-back-to-shop`, the product-not-found "back to shop", the auth bottom links
  ("Créer un compte", "Se connecter", "Retour à la connexion") and "Mot de passe oublié ?".
- `cart-line-remove-*`: today an icon alone with no accessible name. It becomes `variant="ghost"
size="sm"` with the `Trash2` icon and the visible label `cart.removeLine`. Same testid, same
  dialog.
- `shop-category-sheet-trigger`: `h-9` becomes `h-11`.
- `category-rail.tsx` rows: `py-1.5 text-sm` becomes `min-h-11 text-base`.
- The view toggle (three icons with an `aria-label` each) stays icon-only: it is a display choice,
  neither navigation nor a main action. Decision to confirm, see the questions.
- `AppSettingsMenu` trigger: `size-9` becomes `size-11`, icon `size-5`. Stays an icon with its
  `aria-label`; it is a secondary control, not navigation. Decision to confirm, see the questions.

### Overflow fixes at 390 px

The two seen on slice 01's screenshots, and the ones found by reading the code:

1. **Top bar** — "Participation" cut off. Fixed by the phone header and the tab bar.
2. **Shop card, "Choisir les options" and "Ajouter"** — the button is `whitespace-nowrap` in a
   card about 143 px wide inside. `QuickAddToCart`'s button and `AddToCartControl`'s add button get
   `h-auto whitespace-normal text-center` plus the minimum height of their size (`min-h-11` for
   `sm`, `min-h-12` for `default`). `cn` lets them override the button's `whitespace-nowrap` and
   fixed height, so a long label wraps on two lines inside the card and never gets shorter than
   44 px.
3. **Shop card, quantity stepper** — minus (44) + amount field (64) + unit + plus (44) needs about
   190 px; a 2-column card has 143. The stepper becomes a container query: its root `div` gets
   `@container w-full` and keeps `data-testid={testIds.root}`; the inner row is
   `flex items-center justify-between gap-2 @max-[12rem]:flex-wrap`; the amount group gets
   `@max-[12rem]:order-first @max-[12rem]:basis-full @max-[12rem]:justify-center`. Narrow cards
   show the amount on its own line above the two keys; the product page and the cart, wider, keep
   one line. The small-size amount field loses its `h-7` override (28 px, under the touch target)
   for `h-11`; the stepper icons go from `size-3` to `size-4`.
4. **Shop grids** — the default "large" view stays `grid-cols-2` on phones (the owner's "grid kept"
   decision), `sm:grid-cols-3` unchanged. The "compact" view goes from `grid-cols-3` to
   `grid-cols-2 sm:grid-cols-4 lg:grid-cols-5`: three columns of 110 px cannot hold a 44 px key
   pair. The card spacing drops on phones: `[--card-spacing:--spacing(3)]
sm:[--card-spacing:--spacing(5)]` on the large card.
5. **Product card look (the mockup)** — name `text-lg font-bold` (18 px, was the card title's
   serif `text-base`), price `font-serif text-xl font-bold italic` (Lora italic bold, 20 px; was
   `text-sm font-semibold`), stock line `text-sm text-muted-foreground`, the add button sage
   (`default` variant, already) at the control's `default` size, 48 px. In the list view: name
   `text-lg font-bold`, price `font-serif text-lg italic font-bold`, the list card's
   `ring-1 ring-foreground/10` becomes `border-2 border-border`, its right column goes from `w-40`
   to `w-36 sm:w-44` and holds the wrapping stepper.
6. **Cart table** — fixed column widths add up to 472 px. Below 768 px the same table is stacked,
   with `max-md:` classes only, the `table`, `tbody` and `tr` elements kept (the cart tests count
   `tbody tr` and find rows by `tr`):
   - `Table` `max-md:block`, `TableHeader` `max-md:hidden`, `TableBody` `max-md:block`;
   - each `TableRow` `max-md:grid max-md:grid-cols-[1fr_auto] max-md:items-center max-md:gap-x-3
max-md:gap-y-2 max-md:py-4`, each `TableCell` `max-md:block max-md:p-0`;
   - product cell `max-md:col-span-2`; quantity cell (stepper) left, remove button right; unit
     price left with a phone-only prefix `<span className="md:hidden">{t('cart.unitPrice')}
</span>`, line total right with `{t('cart.lineTotal')}` the same way;
   - from 768 px up the table is as today, the remove column widens from `w-14` to `w-32` for its
     label. The 768 px width (`max-w-3xl` minus padding, 720 px) still leaves the product column
     about 170 px.
   - The total and checkout row gets `flex-wrap gap-3`.
7. **Account** — status line under the title gets `flex-wrap` (badge, dot, fee text with two
   amounts is wider than 358 px in French).
8. **Auth pages** — the login error box `h-10` and the register error box `h-6` are fixed heights:
   at 16 px the French error already wraps on two lines. They become `min-h-10` and `min-h-7`.

### The order of work, with the first failing test of each step

Each step: write or extend `apps/web-spa-e2e/tests/member-phone.spec.ts` first, run it alone on the
disposable E2E stack and save the red output to a scratchpad log, then write production code, then
green, then format the changed files by name and commit. The test file holds these helpers, used
by every step:

- `expectNoHorizontalScroll(page)` — `document.documentElement.scrollWidth` is at most
  `clientWidth`.
- `findSpilledControls(page)` — for every visible `button`, `a` and `input` inside `main`: its box
  lies inside the box of its nearest card (`[data-slot="card"]`, `[data-testid^="shop-product-card-"]`)
  or, failing one, inside the viewport; and its own `scrollWidth` is not above its `clientWidth`
  (text cut or sticking out). Returns the offenders' testid or text; the test expects `[]`.
- `findSmallOrCapitalText(page)` — the visible-text walker of `market-theme.spec.ts` (under 14 px,
  or `text-transform: uppercase`), copied, not imported, since spec files do not import each
  other in this suite.
- `useEveningMode(page)` — `page.addInitScript` that sets `localStorage['app-theme'] = 'dark'`
  before the app reads it.

`test.use({ viewport: { width: 390, height: 844 } })` at the top; the desktop cases set their own
viewport.

1. **Shell and tab bar.** First failing test: "un membre se connecte et passe d'un onglet à
   l'autre". Signed out (empty storage state), it opens `/login` at 390 × 844, signs in through the
   form as `E2E_USERS.member` with `E2E_PASSWORD`, lands on the shop, then for Shop, Cart,
   Participation, My account in turn: clicks `tab-bar-<tab>`, checks the URL and the page's
   `page-*` testid, checks that this tab and only this one has `aria-current="page"`, and checks no
   horizontal scroll. It also checks that `member-tab-bar` is a `navigation` with an accessible
   name, that each tab is at least 44 px high, holds an `svg` and a visible label of 14 px or more,
   and that each label is whole (`scrollWidth` not above `clientWidth`). A second case, signed
   out on `/shop`: exactly three tabs, Shop, Cart, Sign in, and no `tab-bar-account`. A third,
   as the member: after `resetDb`, a quick add on the shop shows `tab-bar-cart-count` with "1", and
   the success toast's box ends above the tab bar's top. A fourth, as the member on `/account`
   scrolled to the bottom: `account-end-open` ends above the tab bar's top. **Expected red:**
   `member-tab-bar` / `tab-bar-*` not found. Then: `member-shell.tsx`, `member-tab-bar.tsx`,
   both layouts, the `root.tsx` viewport and body padding, the i18n keys. Green.
2. **Phone header and menu; desktop untouched.** First failing test: at 390, `phone-menu-trigger`
   is visible with the text "Menu", the desktop `site-nav-cart` is hidden, and the top bar has no
   horizontal overflow (header `scrollWidth` not above `clientWidth`). Opening the menu as a member
   shows `phone-menu-theme`, `phone-menu-lang-fr`, `phone-menu-lang-en`, `phone-menu-logout` and no
   `phone-menu-admin`; `phone-menu-theme` turns `body` dark; `phone-menu-logout` lands on `/login`.
   As an admin, `phone-menu-admin` leads to `/admin/members`. At 1440 × 900 as a member:
   `member-tab-bar` and `phone-menu-trigger` are hidden, and each of `site-nav-cart`,
   `site-nav-participation`, `site-nav-account`, `nav-logout` holds an `svg` and visible text;
   signed out, `site-nav-signin` too (**this one is red today**: no icon). At 768 × 1024 as an
   admin: the tab bar is hidden, the desktop controls are visible, and there is no horizontal
   scroll. **Expected red:** `phone-menu-trigger` not found. Then: `site-header.tsx`,
   `phone-menu.tsx`, `app-settings-items.tsx`, `app-settings-menu.tsx`. Green, and the existing
   `app-settings.spec.ts` and `market-theme.spec.ts` are run alone to show the desktop testids
   still work.
3. **Shop and cart at 390.** First failing test: "rien ne déborde à 390 px", for light then
   evening mode, as the member after `resetDb`: on `/shop` (default view, checked to be
   `data-view="large"`), on the first product page reached by `shop-product-card-link`, after a
   quick add of "Pommes Golden" (a by-weight product, so its card shows the stepper with a field
   and a unit), on `/shop` again with the stepper showing, and on `/cart` with that line:
   `expectNoHorizontalScroll` and `findSpilledControls` give nothing. Also: on `/shop` the first
   card that has a `quick-add-submit-*` button shows the text "Ajouter", and a card that needs a
   choice shows "Choisir les options". **Expected red:** `/shop`, "Choisir les options" sticks out
   of its card (seen on slice 01's screenshot); `/cart`, horizontal scroll. Then: the shop and cart
   files above. Green.
4. **Member screens' text.** First failing test: on `/shop`, `/cart`, `/account`, `/participation`
   at 390, light and evening: `findSmallOrCapitalText` gives nothing, `expectNoHorizontalScroll`
   and `findSpilledControls` too, and `body` font size is 18 px. **Expected red:** `/account`, the
   six field labels are uppercase. Then: account, member QR, wallet, participation files, the shop
   aside heading, the text sizes and raw colours above. Green.
5. **Sign-in pages.** First failing test: signed out, for each of `/login`, `/register`,
   `/verify-email`, `/forgot-password`, `/reset-password` at 390: `auth-brand` is visible, its
   font family starts with `Lora Variable`, `[data-slot="awning-band"]` is in the page, no
   horizontal scroll, `findSmallOrCapitalText` and `findSpilledControls` give nothing (the checker
   uses the viewport there, no `main`: it reads the whole `body` for auth pages); at 1440 on
   `/login`, `auth-aside` is visible, and at 390 it is hidden. **Expected red:** `auth-brand` not
   found. Then: `auth-layout.tsx`, `auth-page-header.tsx`, the auth pages and forms. Green.
6. **Gates, screenshots, formatting.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
   then `pnpm e2e` (after `docker ps` and a look at the machine load), each in the background with
   its full log in the scratchpad, read in full. Screenshots on the E2E stack at 390, 1194 and
   1440 px, light and evening, of `/shop`, a product page, `/cart`, `/account`, `/participation`,
   `/login` and `/register` (slice 01's `scratchpad/shots.mjs`, extended). `oxfmt` on the changed
   files by name, a few at a time.

The Typist stops any dev server it starts in the same step, by PID, or reports the PIDs.

### How each criterion is checked

| Criterion            | Check                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `mobile-tab-bar`     | Step 1 cases: four tabs signed in, three signed out, `nav` with a name, `aria-current`, 44 px, icon and 14 px label, cart count, toast and last line above the bar. Safe-area inset: read in the class strings at the review (Playwright cannot emulate it). |
| `phone-header`       | Step 2 cases at 390: name and labelled "Menu", menu content per role, no top-bar overflow.                                                                                                                                                                   |
| `desktop-nav`        | Step 2 cases at 1440 and 768; the whole existing E2E suite at 1440 green with no test edited (it uses every listed desktop testid); `grep` that no new testid equals an old one.                                                                             |
| `awning-band-placed` | Step 1 (shell) and step 5 (auth) cases look for `[data-slot="awning-band"]`; screenshots.                                                                                                                                                                    |
| `no-overflow-phone`  | Step 3 and step 4 cases, light and evening, on every route of the criterion; step 5 for `/login` and `/register`; screenshots at 390.                                                                                                                        |
| `shop-grid-default`  | Step 3 case: `data-view="large"` on first load at 390, "Ajouter" and "Choisir les options" visible; `shop-view-list` still present.                                                                                                                          |
| `sign-in-pages`      | Step 5 cases on the five routes; screenshots of `/login` and `/register` at three widths.                                                                                                                                                                    |
| `no-forced-capitals` | `grep -n uppercase` on the listed files empty at the close; step 4 and 5 walkers find no uppercase text.                                                                                                                                                     |
| `readable-text`      | `grep -nE 'text-\[[0-9.]+(px                                                                                                                                                                                                                                 | rem)\]'`on the listed files empty; step 4 and 5 walkers find nothing under 14 px;`body` 18 px; the body-text list above read at the review. |
| `theme-colours-only` | `grep` for raw Tailwind palette names and hex values on the listed files empty at the close (the commands in Notes & Snippets).                                                                                                                              |
| `icon-with-label`    | Step 1 and 2 cases (every tab and every desktop link has an `svg` and visible text); the review reads the remove button and the link buttons.                                                                                                                |
| `phone-check-test`   | Step 1's red log, saved before any production file of step 1 exists, and its green log.                                                                                                                                                                      |
| `i18n-intact`        | A small Node check at the close that every key of the French file exists in the English file and the reverse (scratchpad script, not committed); `grep` for quoted French words in the changed `.tsx` files; the review.                                     |
| `e2e-green`          | `pnpm e2e` full log; `git diff --stat cc7104e -- apps/web-spa-e2e` shows only the new file.                                                                                                                                                                  |
| `suite-green`        | The four gate logs.                                                                                                                                                                                                                                          |

### Questions for the Architect

1. **Phone grid: two columns or the mockup's one-column card.** The mockup's phone card puts name,
   detail and price on the left and the "Ajouter" button on the right, one card per row. The
   owner kept "grid" as the default view. I plan two columns (the grid the owner kept, with the
   mockup's type sizes and a wrapping button and stepper). The other way: one column of
   horizontal cards on phones, closer to the mockup, but then the grid and the list views look
   almost the same on a phone. Recommendation: two columns.
2. **Settings trigger and view toggle stay icon-only** (each with an `aria-label`), as secondary
   controls that are neither navigation nor a main action. The settings trigger grows to 44 px. A
   visible "Paramètres" label would make the desktop bar wrap sooner. Recommendation: keep them
   icon-only.
3. **`viewport-fit=cover` and the body's side padding in `root.tsx`** touch every layout, not only
   this slice's. Without them the safe-area part of `mobile-tab-bar` cannot work on iOS.
   Recommendation: accept.
4. **The Inter font from Google Fonts.** `root.tsx` still links an Inter stylesheet from
   `fonts.googleapis.com`, which nothing uses since slice 01 (Onest and Lora come from
   `@fontsource`). The parent spec says no font is loaded from Google Fonts. Since this slice
   edits `root.tsx`, I can remove the three `links` entries. Recommendation: remove them here, in
   their own commit.
5. **The wallet dialogs** (`record-payment-form.tsx`, `correct-payment-dialog.tsx`,
   `refund-dialog.tsx`) sit in `features/wallet` but only the distribution and back office use
   them. They hold no capitals, raw colours or tiny text, so the criteria pass on them as they are.
   I leave their `text-sm` labels to slices 03 and 04. Recommendation: accept.

## Worklog

- 2026-11-25 — Mason: read the reading list (README, documentation index, general and frontend
  guidelines, constitution, `CONTRIBUTING.md`, `.cursor/rules`, the journal), both specs, slice
  01's work document and its 390 px shop screenshot, the shell, header, layouts, every screen file
  of the slice, the E2E config and the tests that touch navigation and the cart. Ran the searches
  in Notes & Snippets. Wrote this plan. No production code yet.
- 2026-11-25 — Typist, extra commit (ruling 4): the grep for the word Inter over `apps/web-spa/app` and
  `packages/ui/src` (ts, tsx, css) finds only the Google Fonts link in `root.tsx`; no font setting
  names Inter. Removed the three `links` entries and the empty `links` export (`Route` is still used
  by `ErrorBoundary`, nothing else needs `LinksFunction`). Own commit 9685e98.
- 2026-11-25 — Typist, step 1. Red: `s02-step1-red.log`, 4 failed, 1 passed (the setup). The error
  line is `Error: element(s) not found ... waiting for getByTestId('member-tab-bar')` (and
  `tab-bar-cart-count` for the cart count case). Green: `s02-step1-green.log`, 5 passed.
  `pnpm typecheck` clean (`s02-step1-typecheck.log`). Landed: `member-shell.tsx`,
  `member-tab-bar.tsx`, both layouts, `root.tsx` viewport and body padding, five i18n keys of the
  plan's table that step 1 needs (`mainNavigation`, `menu`, `cartItems_*`; `cart.removeLine` comes
  with step 3). Departures from the plan: (1) the "no horizontal scroll" check on each tab is not in
  step 1's test. On the first green run `/shop` scrolled to 786 px, because the old top bar (step 2)
  and the shop cards (step 3) still overflow, so the plan's step 1 assertion cannot be green before
  those steps. Step 4's test must check all four tabs for horizontal scroll; the Mason should keep
  that in mind. (2) The toast case polls the toast's box until it rests, because Sonner slides it in.

- 2026-11-25 — Typist, step 2, then the Mason after the usage limit stopped the Typist. The red
  run was saved before any production file of the step (`s02-step2-red.log`, 14:41; the step's
  production files date from 14:42): 6 failed, among them `phone-menu-trigger` not found and
  `site-nav-signin` with no `svg`. The Typist's green run (`s02-step2-green.log`) still had 1
  failure, and so did the Mason's rerun (`s02-step2-green2.log`): at 1440 px the member was signed
  out. Cause: the case "se déconnecter depuis le menu" used the shared member session, and
  `signOut` revokes it on the server, so every later member case in the run was signed out (in the
  full suite it would break the other member specs too). **Mason's retouch** (a few lines of test
  setup, no assertion changed; the Typist was gone): that case now starts signed out and signs in
  through the form, as `auth-logout.spec.ts` does. Green: `s02-step2-green3.log`,
  `member-phone.spec.ts` with `app-settings.spec.ts` and `market-theme.spec.ts`, 21 passed.
  `pnpm typecheck` clean (`s02-step2-typecheck.log`). Landed: `site-header.tsx`, `phone-menu.tsx`,
  `app-settings-items.tsx`, `app-settings-menu.tsx` (44 px trigger with `aria-label` and `title`).

- 2026-11-25 — Typist, step 3. Red: `s02-step3-red.log`, 3 failed, 12 passed. Errors: "Choisir les
  options (texte coupé)" three times in the spilled-controls check, and `Expected: >= 48 Received: 44`
  for the "Ajouter" button. Green: `s02-step3-green.log`, 15 passed. `cart.spec.ts`,
  `checkout.spec.ts` and `shop-catalog.spec.ts` alone: `s02-step3-others.log`, 15 passed and 1
  failed, "ajout rapide et ajustement depuis la grille" (second click on the decrease key, element
  detached). That case is flaky without this slice's changes too: 2 failures in 8 runs with the
  production files stashed (`s02-step3-cart-baseline.log`), and 1 in 3 with them
  (`s02-step3-cart-rerun.log`). `pnpm typecheck` clean (`s02-step3-typecheck.log`). Landed:
  `add-to-cart-control.tsx` (wrapping add button, stepper in a container query), `quick-add-to-cart.tsx`
  (default size, 48 px), `product-card.tsx` (mockup type, tighter spacing on phones, list card),
  `shop-page.tsx` (compact view in 2 columns on phones), `cart-page.tsx` (stacked table below 768 px,
  "Retirer" label, wrapping total row), `cart.removeLine` in both locales. Departures: (1) the
  container query cannot style its own element, so `AddToCartControl` has an outer `@container` div
  (keeps the `root` testid and the caller's `className`) and an inner row that carries the
  `@max-[12rem]` classes. (2) The helper `findSmallOrCapitalText` is removed from the spec for now: it
  was unused after `export` came off and `tsc` refuses unused functions. Step 4 adds it back with its
  cases. (3) Ruling 2's `title` on the shop view switch is NOT done: the `SegmentedControl` option
  takes `ariaLabel` but no title, and `packages/ui` is out of bounds. Reported to the Architect.

## Implementation Checkboxes

- [x] Step 1 — shell and tab bar: phone test red, then green
- [x] Step 2 — phone header and menu, desktop checks: red, then green
- [x] Step 3 — shop and cart overflow at 390, light and evening: red, then green
- [ ] Step 4 — member screens' text, capitals and colours: red, then green
- [ ] Step 5 — sign-in pages: red, then green
- [ ] Step 6 — five gates green, screenshots taken, files formatted

## Notes & Snippets

**Architect's rulings at the plan reading** (Architect, 2026-11-25, written by the Mason):

1. **Phone shop grid: two columns.** The owner chose the grid over the Architect's advice, so it
   stays. Each card's add button must still show "Ajouter" at 48 px or more, with no overflow at
   390 px.
2. **Icon-only controls: an accepted exception to `icon-with-label`.** The settings button and the
   shop view switch stay icon-only, as secondary controls. Each carries an `aria-label` and a
   `title`. On phones the settings sit inside the labelled "Menu" anyway.
3. **Safe area: accepted.** `viewport-fit=cover` and the safe-area padding go in `root.tsx`. The
   1440 px screenshots are checked for any change on the other layouts, and the worklog says so.
4. **Inter: removed, in its own commit.** First a `grep` shows that nothing names Inter.
5. **Wallet dialogs: left to slices 03 and 04.** `record-payment-form.tsx`,
   `correct-payment-dialog.tsx` and `refund-dialog.tsx` serve the distribution table and the back
   office; their small labels are restyled there.

Also accepted: the visible "Retirer" label on the cart remove button, the link buttons that keep
their testids, the shop card type from the mockup, and CSS breakpoints instead of `useIsMobile`.

**Searches run on 2026-11-25** from `apps/web-spa/app`, over the files of the criteria
(`F` = `features/shop features/cart features/account features/wallet features/participation
features/auth features/common/components/site-header.tsx
features/common/components/shop-layout.tsx features/common/components/member-area-layout.tsx`):

- `grep -rn uppercase $F` — 4 lines: `shop-page.tsx` (aside heading), `account-page.tsx` twice
  (field labels), `site-header.tsx` (app name).
- `grep -rnE 'text-\[[^]]+\]' $F` — nothing.
- `grep -rnE '(bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|divide|shadow|accent|caret)-(red|green|lime|amber|yellow|orange|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black)\b' $F`
  — 4 lines: `member-qr.tsx` `bg-white`, `text-red-500` in `auth-login-page.tsx`,
  `auth-forgot-password-page.tsx`, `auth-register-page.tsx`. (`slate` is also a theme token since
  slice 01; at the close, a `bg-slate`/`text-slate-foreground` hit is a theme token, not a raw
  colour.)
- `grep -rnE '#[0-9a-fA-F]{3,8}\b' $F` — nothing.
- `grep -rn 'text-xs' $F` — 14 lines, all 14 px since slice 01.

**E2E locators checked** for the CSS choice: no `getByText` on a navigation label; the cart tests
use `tbody tr`, `tr` with `hasText`, and testid prefixes inside a row, all kept by the stacked
table; the settings tests use `app-settings-trigger`, `app-settings-theme`, `app-settings-lang-en`
at 1440.

**Width arithmetic at 390 px:** page padding 16 px each side gives 358 px. Two grid columns with a
16 px gap give 171 px cards; minus the 2 px borders and 12 px card spacing, 143 px inside. The
stepper needs 44 + 8 + 64 + 4 + unit + 8 + 44, about 190 px, hence the container query at 12 rem
(192 px). A tab column is 390 / 4 = 97.5 px.

## Diff-Review Findings

Written after `code-review` runs.
