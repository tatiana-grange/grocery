# 02 — Member space and sign-in

**Status:** done
**Blocked by:** [01 — Theme and shared components](01-theme-and-shared-components.spec.md) (done)
**Parent:** [UI redesign — the "neighbourhood market" direction](../20261125-1155-ui-market-redesign.spec.md)

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

**What to build:** the shop, the member area and the sign-in pages laid out the "neighbourhood
market" way. On a phone, members move between the shop, the cart, participation and their account
with a tab bar fixed at the bottom of the screen. On a tablet or a computer, the navigation stays at
the top. The awning band from slice 01 tops each of these layouts. The journeys keep their steps:
only the layout, the navigation and the density change.

The reference is the artboard "Boutique — mobile" on the page "Marché de quartier" of the canvas the
parent spec links. The mockup shows a greeting, the wallet balance, the next distribution and a row of
categories at the top of the shop. Those need data the screens do not load today: they are **not**
part of this slice (see "Not included"). The mockup's tab says "Créneaux"; the owner chose to keep
"Participation".

## Acceptance criteria

- [x] **mobile-tab-bar** — below 768 px wide, the shop and member area layouts show a tab bar fixed
      at the bottom of the screen. A signed-in member sees four tabs: Shop, Cart, Participation, My
      account. A signed-out visitor sees Shop, Cart and Sign in. Each tab shows an icon **and** its
      label (14 px or more), is at least 44 px high, and the current tab carries `aria-current="page"`.
      The Cart tab shows the number of items when the cart is not empty. The tab bar is a `nav` with an
      accessible name. Page content and toasts are never hidden behind it, including on phones with a
      home indicator (safe-area inset).
- [x] **phone-header** — below 768 px, the top bar shows the app name and one labelled "Menu" button.
      The menu holds what the tab bar does not: the settings (theme, language), the back office link for
      admins, and sign-out. Nothing in the top bar overflows at 390 px.
- [x] **desktop-nav** — from 768 px up, the tab bar is not shown and the top navigation holds every
      link it holds today, each with an icon and a visible label. Its existing `data-testid` attributes
      (`site-nav-cart`, `site-nav-cart-count`, `site-nav-admin`, `site-nav-participation`,
      `site-nav-account`, `site-nav-signin`, `nav-logout`, `app-settings-*`) stay on the desktop
      controls. The tab bar and the phone menu use new `data-testid` values of their own, so no test
      locator ever matches two elements.
- [x] **awning-band-placed** — the `AwningBand` of slice 01 sits at the top of the shop, member area
      and sign-in layouts.
- [x] **no-overflow-phone** — at 390 px wide, in light and evening mode, `/shop`, a product page,
      `/cart`, `/account`, `/participation`, `/login` and `/register` have no horizontal scroll, and no
      label or button is cut or sticks out of its card. In particular, the "Participation" link is whole
      and the shop card's "Choisir les options" button stays inside its card.
- [x] **shop-grid-default** — the shop still opens in the grid view, on phones too. Each product card
      that can be added straight away shows a button with the word "Ajouter" ("Add"); a card that needs a
      choice keeps its "Choisir les options" button. The list view stays one choice away.
- [x] **sign-in-pages** — `/login`, `/register`, `/verify-email`, `/forgot-password` and
      `/reset-password` use the market look: the "Grocery" name in Lora instead of the anvil logo, the
      awning band, fields and buttons of the theme. The explanatory side panel stays on large screens.
- [x] **no-forced-capitals** — no `uppercase` class left in the files of `features/shop`,
      `features/cart`, `features/account`, `features/wallet`, `features/participation`, `features/auth`
      and in `site-header.tsx`, `shop-layout.tsx`, `member-area-layout.tsx`.
- [x] **readable-text** — in those same files, no text below 14 px (`text-[10px]`, `text-[11px]`,
      `text-[12px]` and the like go), and body text is 18 px.
- [x] **theme-colours-only** — in those same files, no raw Tailwind colour (`amber-*`, `red-*`,
      `green-*`, `lime-*` and the like) and no hex value: only theme variables.
- [x] **icon-with-label** — no navigation link or main action in those screens is an icon alone.
- [x] **phone-check-test** — a new Playwright test at 390 × 844 signs in, moves between the four
      tabs, checks `aria-current` and the URL at each step, and checks the page has no horizontal scroll.
      It fails before the tab bar exists.
- [x] **i18n-intact** — no hard-coded text; every new key exists in French and English.
- [x] **e2e-green** — `pnpm e2e` passes with no existing test edited, skipped or deleted.
- [x] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## Seams

- **The shared top bar** (`apps/web-spa/app/features/common/components/site-header.tsx`) — today one
  bar for the shop and the member area. It keeps that role from 768 px up.
- **A new member tab bar** in `features/common/components/` — rendered by the shop and member area
  layouts, below 768 px only.
- **The layouts** `shop-layout.tsx`, `member-area-layout.tsx` and
  `features/auth/components/auth-layout.tsx` — they place the awning band, the bars and the content
  width. Their guards and redirects do not change.
- **The screens** of the shop, cart, account, wallet top-up return, participation and sign-in
  features — their look and density change; their logic, routes and `data-testid` do not.

## Not included

- The greeting, the wallet balance in the header, the next distribution banner and the category row
  of the mockup. They need new data on every page; an idea for later.
- Renaming "Participation" to "Créneaux".
- The distribution table (slice 03) and the back office (slice 04).
- Any change to a route, a guard, the API or a journey's steps.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Notes

- The E2E suite runs at 1440 × 900, so it only sees the desktop navigation. That is why the desktop
  controls keep their `data-testid` and the tab bar gets its own: two elements behind one locator
  would break Playwright's strict mode, even if one is hidden by CSS.
- The 390 px screenshots of slice 01 (`scratchpad/screens/`, see the slice 01 work document) show
  the two overflows named in `no-overflow-phone`.
- Use the shared components of `packages/ui` as they are. If a screen needs a component change, it
  goes into `packages/ui` with its props unchanged, and the work document says why.
- **At the close** (Mason, 2026-11-25): `icon-with-label` is ticked with the exception the
  Architect accepted at the plan reading: the settings button and the shop view switch stay
  icon-only, each with an `aria-label` and a `title`; on phones the settings sit inside the labelled
  "Menu". The quantity stepper's plus and minus keys are also icon-only with an `aria-label`; they
  are neither navigation nor a main action. The evidence for every criterion is in the work
  document, "How each criterion is checked" and the Worklog.
