# 01 — Theme and shared components — work

Created by the Mason at the plan step, 2026-11-25. Spec:
`project-management/tasks/20261125-1155-ui-market-redesign/01-theme-and-shared-components.spec.md`.
The parent spec, with the colour values and the owner's decisions, is
`project-management/tasks/20261125-1155-ui-market-redesign.spec.md`.

**Plan:** approved by the Architect, 2026-11-25, with the rulings in Notes & Snippets.

## Program Design

### What changes, in one paragraph

The theme file gets the "neighbourhood market" values for both modes, written in hex so a test can
read them. The text scale is raised in the theme itself, so every `text-*` class in the app grows at
once. The shared components that `apps/web-spa` imports get the market look: 2 px ink-brown borders,
12 px corners, taller controls, bigger text, no forced capitals. A new `AwningBand` component draws
the striped awning from theme variables. Props, `data-testid` values and ARIA roles do not move.
Two new test files guard the theme (unit, Vitest) and one new browser test guards what a member
really sees (Playwright). No existing test is touched.

### Files

| File                                                                     | Change                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/styles/globals.css`                                     | New tokens for both modes, fonts, radius, text scale, awning tokens and utility, `bg-gradient-bg` redrawn from theme variables, Host Grotesk import removed.                                                                                  |
| `packages/ui/package.json`                                               | Remove `@fontsource-variable/host-grotesk`. Add `vitest` (same `^4.1.x` range as `packages/i18n`) as a dev dependency and a `test` script `vitest run --config=vitest.config.ts`.                                                             |
| `packages/ui/vitest.config.ts`                                           | New, copied from `packages/i18n/vitest.config.ts`: node environment, `include: ['src/**/*.spec.{ts,tsx}']`, `esbuild: { jsx: 'automatic' }`, and an alias `@grocery/ui` to `./src` (the package resolves itself through its `tsconfig` path). |
| `packages/ui/tsconfig.json`                                              | Add `**/*.spec.tsx` to `exclude`, beside the `*.spec.ts` already excluded.                                                                                                                                                                    |
| `packages/ui/src/styles/theme.spec.ts`                                   | New unit test: reads `globals.css`, checks palette, fonts, text scale and every contrast pair below.                                                                                                                                          |
| `packages/ui/src/components/component-rules.spec.ts`                     | New unit test: scans `packages/ui/src` for `uppercase` and for arbitrary text sizes under 14 px.                                                                                                                                              |
| `packages/ui/src/components/app/awning-band.tsx`                         | New component.                                                                                                                                                                                                                                |
| `packages/ui/src/components/app/awning-band.spec.tsx`                    | New unit test, server-rendered with `react-dom/server`.                                                                                                                                                                                       |
| `packages/ui/src/components/app/index.tsx`                               | Export `AwningBand`.                                                                                                                                                                                                                          |
| `packages/ui/src/components/primitives/*.tsx` and `components/app/*.tsx` | Class strings only, listed component by component below.                                                                                                                                                                                      |
| `apps/web-spa-e2e/tests/market-theme.spec.ts`                            | New browser test.                                                                                                                                                                                                                             |
| `pnpm-lock.yaml`                                                         | Follows the two dependency changes.                                                                                                                                                                                                           |

`apps/web-spa` is not edited in this slice. `packages/ui/src/components/layout/` (`Header.tsx`,
`Navigation.tsx`) is imported by nothing in `apps/web-spa`: it is left alone.

### The tokens

All values are written in hex in `:root` (light) and `.dark` (evening). The `@theme inline` block
keeps mapping them to Tailwind colours, and gains four new colour mappings: `straw`, `kraft`,
`slate`, `rule`, each with its `-foreground` where text can sit on it.

| Token                                    | Light                             | Evening (dark)        | Note                                                         |
| ---------------------------------------- | --------------------------------- | --------------------- | ------------------------------------------------------------ |
| `background` / `foreground`              | `#F7F1E3` / `#2B241C`             | `#2F3A33` / `#F7F1E3` | cream and ink; slate and cream                               |
| `card`, `popover` / their foreground     | `#FFFCF5` / `#2B241C`             | `#3A473F` / `#F7F1E3` |                                                              |
| `muted` / `muted-foreground`             | `#EDE4D0` / `#5C5246`             | `#26302A` / `#D3C9B3` |                                                              |
| `accent` / `accent-foreground`           | `#EDE4D0` / `#2B241C`             | `#46544B` / `#F7F1E3` | hover and selected rows                                      |
| `primary` / `primary-foreground`         | `#4E6B4A` / `#FFFCF5`             | `#4E6B4A` / `#FFFCF5` | sage, the same in both modes                                 |
| `secondary` / `secondary-foreground`     | `#D9C3A0` / `#2B241C`             | `#D9C3A0` / `#2B241C` | kraft                                                        |
| `warning` / `warning-foreground`         | `#B4541A` / `#FFFCF5`             | `#B4541A` / `#FFFCF5` | squash, the same in both modes                               |
| `destructive` / `destructive-foreground` | `#9B2C22` / `#FFFCF5`             | `#F2A595` / `#2B241C` | brick red; lighter at night so it reads as text on slate     |
| `success` / `success-foreground`         | `#3B6E3F` / `#FFFCF5`             | same                  |                                                              |
| `info` / `info-foreground`               | `#2F5D73` / `#FFFCF5`             | same                  |                                                              |
| `straw` / `straw-foreground`             | `#E9C46A` / `#2B241C`             | same                  | decoration only                                              |
| `kraft` / `kraft-foreground`             | `#D9C3A0` / `#2B241C`             | same                  | decoration only                                              |
| `slate` / `slate-foreground`             | `#2F3A33` / `#F7F1E3`             | same                  | decoration only                                              |
| `border`                                 | `#2B241C`                         | `#D9C3A0`             | the 2 px outline of controls and cards                       |
| `input`                                  | `#2B241C`                         | `#D9C3A0`             | field borders                                                |
| `rule` (new)                             | `#D9C3A0`                         | `#5E6E63`             | soft dividers: table rows, separators                        |
| `ring`                                   | `#4E6B4A`                         | `#E9C46A`             | focus ring; straw at night because sage is too dark on slate |
| `awning-a` / `awning-b` (new)            | `#4E6B4A` / `#FFFCF5`             | `#4E6B4A` / `#F7F1E3` | the two stripes                                              |
| `chart-1` … `chart-5`                    | sage, squash, straw, kraft, slate | same                  |                                                              |
| `sidebar` / `sidebar-foreground`         | `#FFFCF5` / `#2B241C`             | `#26302A` / `#F7F1E3` |                                                              |
| `sidebar-primary` / its foreground       | `#4E6B4A` / `#FFFCF5`             | same                  |                                                              |
| `sidebar-accent` / its foreground        | `#EDE4D0` / `#2B241C`             | `#46544B` / `#F7F1E3` |                                                              |
| `sidebar-border`                         | `#D9C3A0`                         | `#5E6E63`             | soft, like `rule`                                            |
| `sidebar-ring`                           | `#4E6B4A`                         | `#E9C46A`             |                                                              |

Shadows keep their scale but are tinted ink-brown (`rgb(43 36 28 / …)`) instead of black.
`bg-gradient-bg` (used on `body` by `apps/web-spa/app/root.tsx` and by `AppLoader`) is redrawn
with `color-mix()` of `--straw` and `--primary` at a few percent, so it carries no Citrus value
and follows the mode. `::selection` keeps using `primary`.

### Contrast of every text-on-background pair

WCAG 2 contrast ratio, computed from the hex values above. The unit test recomputes each one and
fails under 4.5:1.

| Pair                                            | Light | Evening |
| ----------------------------------------------- | ----- | ------- |
| `foreground` on `background`                    | 13.59 | 10.51   |
| `card-foreground` on `card` (and popover)       | 14.94 | 8.66    |
| `muted-foreground` on `background`              | 6.78  | 7.20    |
| `muted-foreground` on `card`                    | 7.45  | 5.93    |
| `muted-foreground` on `muted`                   | 6.04  | 8.30    |
| `muted-foreground` on `accent`                  | 6.04  | 4.86    |
| `accent-foreground` on `accent`                 | 12.11 | 7.09    |
| `primary-foreground` on `primary`               | 5.81  | 5.81    |
| `secondary-foreground` on `secondary`           | 8.94  | 8.94    |
| `destructive-foreground` on `destructive`       | 7.38  | 7.72    |
| `destructive` as text on `background`           | 6.71  | 5.97    |
| `destructive` as text on `card`                 | 7.38  | 4.92    |
| `warning-foreground` on `warning`               | 4.85  | 4.85    |
| `success-foreground` on `success`               | 5.88  | 5.88    |
| `info-foreground` on `info`                     | 6.98  | 6.98    |
| `straw-foreground` on `straw`                   | 9.16  | 9.16    |
| `kraft-foreground` on `kraft`                   | 8.94  | 8.94    |
| `slate-foreground` on `slate`                   | 10.51 | 10.51   |
| `sidebar-foreground` on `sidebar`               | 14.94 | 12.12   |
| `sidebar-accent-foreground` on `sidebar-accent` | 12.11 | 7.09    |
| `background` on `foreground` (tooltip)          | 13.59 | 10.51   |

Non-text contrast (WCAG 1.4.11, 3:1), for information: `border` on `background` 13.59 / 6.91,
`border` on `card` 14.94 / 5.70, `ring` on `background` 5.29 / 7.09. The `rule` dividers are
decoration and sit at about 1.7:1 on purpose.

**Two pairs are not allowed, and the theme never builds them.** Squash `#B4541A` as text on cream is
4.41:1, under the bar: `warning` is a fill only, always with `warning-foreground` on it. Sage
`#4E6B4A` as text on slate is 1.99:1: no component writes `text-primary` (the `link` variants change
to ink text with a sage underline, see below). The unit test asserts these two are not used by
`packages/ui/src` (no `text-warning`, no `text-primary` outside `text-primary-foreground`).

### Fonts

- Remove the `@fontsource-variable/host-grotesk` import and dependency.
- `--font-sans` stays Onest. `--font-serif` stays Lora.
- `--font-display` becomes `var(--font-serif)`, so headings (the base layer sets `h1`…`h6` to
  `--font-display`) and the one `font-display` class in `auth-layout.tsx` turn to Lora with no edit
  in `apps/web-spa`.

### Radius and text scale

- `--radius: 0.75rem` (12 px). The derived scale gives `rounded-sm` 8 px, `rounded-md` 10 px,
  `rounded-lg` 12 px, `rounded-xl` 16 px. Controls use `rounded-lg`, cards and dialogs `rounded-xl`.
- The Tailwind text scale is redefined in a plain `@theme` block (not `inline`), so every
  `text-*` class in the whole app follows:

  | Class       | Size             | Line height |
  | ----------- | ---------------- | ----------- |
  | `text-xs`   | 14 px (0.875rem) | 1.25rem     |
  | `text-sm`   | 16 px (1rem)     | 1.5rem      |
  | `text-base` | 18 px (1.125rem) | 1.75rem     |
  | `text-lg`   | 20 px            | 1.75rem     |
  | `text-xl`   | 24 px            | 2rem        |
  | `text-2xl`  | 28 px            | 2.25rem     |
  | `text-3xl`  | 32 px            | 2.5rem      |
  | `text-4xl`  | 40 px            | 2.75rem     |

  `body` gets `text-base`, so body text is 18 px. Arbitrary sizes under 14 px inside
  `packages/ui/src` are replaced: button `sm` `text-[0.8rem]` becomes `text-sm`, the two
  `text-[0.8rem]` of `calendar.tsx` become `text-xs`, `file-upload.tsx` `text-[13px]` and
  `text-[11px]` become `text-xs`.

### Components, one by one

Rules for all: `ring-1 ring-foreground/10` outlines become `border-2 border-border`. A plain
`border` on a control becomes `border-2`. `dark:bg-input/30`-style field fills become `bg-card` in
both modes (the `input` token is now a border colour, too bright to tint a field at night). Props,
`data-slot`, `data-testid` and roles are not touched. Only components that `apps/web-spa` imports,
plus what they render, are restyled; the others only follow the tokens and the text scale.

- **Button** (`primitives/button.tsx`) — base: `rounded-lg border-2 font-semibold text-base gap-2`.
  Sizes: `default` `h-12 px-5` (48 px), `sm` `h-11 px-4 text-sm` (44 px), `lg` `h-13 px-6`
  (52 px), `xs` `h-9 px-3 text-sm` (36 px, kept small: only `InputGroupButton` and the combobox use
  it, inside a 48 px field), `icon` `size-12`, `icon-sm` `size-11`, `icon-lg` `size-13`,
  `icon-xs` `size-9`. Variants: `default` `border-border bg-primary text-primary-foreground
hover:bg-primary/90`; `outline` `border-border bg-card hover:bg-muted`; `secondary`
  `border-border bg-secondary text-secondary-foreground hover:bg-secondary/80`; `ghost` stays
  borderless (`border-transparent`); `destructive` becomes solid: `border-border bg-destructive
text-destructive-foreground hover:bg-destructive/90` (the tinted version fails 4.5:1 at night);
  `link` `text-foreground underline decoration-primary decoration-2 underline-offset-4`, no height
  change. Icons grow from `size-4` to `size-5` by default.
- **Input**, **Textarea** — `h-12` (input), `border-2 border-input bg-card rounded-lg px-3
text-base` with no `md:text-sm`; placeholder stays `text-muted-foreground`.
- **NativeSelect** — `h-12 border-2 border-input bg-card rounded-lg px-3 text-base`.
- **Select** — trigger `default` `h-12`, `sm` `h-11`, `border-2`, `text-base`, `bg-card`; popup
  `border-2 border-border`; items `min-h-11 text-base`; group label `text-sm`.
- **Tabs** — list: `rounded-lg p-1 border-2 border-border bg-muted`, horizontal height `h-auto`;
  trigger `min-h-11 px-4 text-base font-semibold text-muted-foreground rounded-md`, active
  `bg-card text-foreground`; `line` variant keeps its underline, now `after:h-1 after:bg-primary`.
  `TabsContent` `text-base`.
- **SegmentedControl** — no change: it renders `Button` at `sm`, so it reaches 44 px through the
  button.
- **Badge** — `h-7 px-3 text-xs font-semibold rounded-full border-2` (14 px text); `outline`
  `border-border`; `destructive` solid like the button, for the same contrast reason; `link` like
  the button link.
- **Card** — `rounded-xl border-2 border-border bg-card text-base`, `--card-spacing` 5 (20 px),
  `sm` 4; `CardTitle` `font-serif text-xl font-semibold`; `CardDescription` `text-sm`;
  `CardFooter` `border-t-2 border-rule bg-muted`.
- **Table** — `text-base`; header row `bg-muted`, `TableHead` `h-12 px-3 font-semibold`;
  `TableCell` `px-3 py-3`; row dividers `border-rule`; hover `bg-accent`; caption `text-sm`.
- **Dialog**, **AlertDialog**, **Sheet**, **Popover**, **DropdownMenu**, **Tooltip** — popups get
  `border-2 border-border rounded-xl` (tooltip `rounded-lg`); body text `text-base`; titles
  `font-serif text-xl font-semibold`; descriptions `text-sm text-muted-foreground`; dialog footer
  `border-t-2 border-rule bg-muted`. Menu items `min-h-11 text-base`, menu labels `text-sm`.
  Overlay `bg-black/10` becomes `bg-foreground/30` (the theme rule: no raw colour). The close
  button of dialog and sheet stays `icon-sm` (now 44 px) with its screen-reader label.
- **Label**, **Form** — label `text-base font-semibold`; `FormDescription` and `FormMessage`
  `text-sm`.
- **Checkbox**, **RadioGroup**, **Switch** — `border-2` and one step bigger (`size-5`); colours
  come from the tokens.
- **Accordion** — trigger `min-h-11 text-base font-semibold`; panel `text-base`.
- **Sidebar** — menu button `default` `h-11 text-base`, `sm` `h-11 text-sm`, `lg` `h-14 text-base`;
  group label `text-sm` (was `text-xs`); sub-button `h-11`; badge `text-xs`. The layout of the
  sidebar is slice 04's.
- **PageTitle** (`app/page-title.tsx`) — `font-serif text-3xl font-bold` (Lora has no black weight).
  **SectionTitle** — loses `uppercase tracking-widest`: `font-serif text-xl font-semibold
text-foreground`. Its comment changes from "uppercased" to what it now is.
- **EmptyState** — description `text-base`; icon disc `bg-muted border-2 border-border`.
- **ListPagination** — no change in this slice (see the questions).
- **Command**, **DropdownMenu** shortcut — keep `tracking-widest` (not capitals); text `text-xs`.

### The awning band

```tsx
// packages/ui/src/components/app/awning-band.tsx
/** A striped market awning with a scalloped edge. Decoration only: hidden from assistive tech. */
export function AwningBand({
  className,
  ...props
}: Omit<ComponentProps<'div'>, 'children'>): JSX.Element
// renders <div aria-hidden="true" data-slot="awning-band" className={cn('awning h-6 w-full shrink-0', className)} {...props} />
```

The `awning` utility lives in `globals.css` (`@utility awning`) and uses only `--awning-a` and
`--awning-b`. Three background layers on one element, 24 px high: stripes 24 px wide on the top
12 px (`repeating-linear-gradient(90deg, a 0 24px, b 24px 48px)`), then one half-disc under each
stripe, in the stripe's colour, for the scalloped edge (two `radial-gradient(circle at 12px 12px,
… 12px, transparent 12.5px)` layers, 48 px apart, the second offset by 24 px). No hex value in the
component. It is not placed in any layout here; slices 02 to 04 place it.

### The order of work, with the first failing check of each step

Each step starts by writing its test and showing it red, then the production change, then green,
then a commit.

1. **Test harness and theme.** Add Vitest to `packages/ui` (config, script, dev dependency).
   Write `theme.spec.ts` first. It checks: the light hex values of the parent criterion
   `market-palette`; no `oklch(` left in `:root` or `.dark` (every Citrus value is `oklch`); no
   `host-grotesk` in `globals.css` or `packages/ui/package.json`; `--font-display` resolves to
   Lora; `--text-base` is `1.125rem` and `--text-xs` is at least `0.875rem`; the evening
   `background` is `#2F3A33`, `foreground` `#F7F1E3`, `primary` and `warning` equal to light; and
   every pair of the contrast table is 4.5:1 or more in both modes. **First red:** the palette
   assertion on today's `oklch` values. Then rewrite `globals.css` and drop Host Grotesk. Green.
2. **Browser test.** Write `apps/web-spa-e2e/tests/market-theme.spec.ts`, run alone against the
   disposable stack. Cases: on `/login` signed out, `body` background is `rgb(247, 241, 227)`, its
   colour `rgb(43, 36, 28)`, its font size `18px`, its font family starts with `Onest Variable`, a
   heading's font family starts with `Lora Variable`, no visible text on the page is under 14 px or
   has `text-transform: uppercase`, and `auth-login-submit`, `auth-login-identifier` and
   `auth-login-mode-email` are at least 44 px high; as a member on `/shop`, `shop-search` and
   `shop-sort` are at least 44 px high, and after the existing theme toggle (`app-settings-trigger`,
   then `app-settings-theme`) the body background is `rgb(47, 58, 51)` and its colour
   `rgb(247, 241, 227)`; as an admin on `/admin/catalog`, `catalog-tab-*` triggers are at least
   44 px high. **First red** (against step 1 only): the 44 px heights. The colours, fonts and the
   18 px body pass after step 1, which is expected: the step 1 commit is the one that turned them.
3. **Components.** Write `component-rules.spec.ts` first: no `uppercase` word in a class string of
   `packages/ui/src`, no `text-[…]` arbitrary size under 14 px, no `text-primary` (other than
   `text-primary-foreground`) and no `text-warning` in `packages/ui/src`. **First red:**
   `SectionTitle`'s `uppercase` and the `text-[0.8rem]`, `text-[11px]`, `text-[13px]` sizes. Then
   restyle the components above. Green, and step 2's browser test turns green.
4. **Awning band.** Write `awning-band.spec.tsx` first: the rendered markup has
   `aria-hidden="true"`, `data-slot="awning-band"`, the `awning` class, keeps a passed
   `className`, and holds no `#` colour; `globals.css` defines `--awning-a` and `--awning-b` in both
   modes and the `awning` utility reads them. **First red:** the import fails, the file does not
   exist. Then write the component and the utility, export it from `components/app/index.tsx`.
5. **Gates and visual check.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then
   `pnpm e2e` (after `docker ps` shows nothing else on 5434, 1093, 1043), each in the background
   with its full log read. Screenshots on the E2E stack at 390, 1194 and 1440 px of `/login`,
   `/shop`, `/distribution` and `/admin/catalog`, light and evening, kept in the scratchpad for
   the Architect and the later pull request. `oxfmt` on the changed files by name, in small
   batches.

### How each slice criterion is checked

| Criterion                  | Check                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `market-palette`           | `theme.spec.ts` (hex values, no `oklch`) and the browser test's body colours                                                                                                         |
| `evening-mode`             | `theme.spec.ts` (evening values, same sage and squash) and the browser test's toggle case                                                                                            |
| `market-fonts`             | `theme.spec.ts` and the browser test's computed font families; `grep -ri "host.grotesk" packages apps/web-spa/app` empty                                                             |
| `readable-text`            | `theme.spec.ts` (text scale), `component-rules.spec.ts` (no tiny arbitrary sizes), the browser test's 18 px body and 14 px floor on `/login`                                         |
| `no-forced-capitals`       | `component-rules.spec.ts`; `grep -rn uppercase packages/ui/src` empty                                                                                                                |
| `touch-targets`            | the browser test's heights (button, segmented button, input, native select, tab) and the reading of the class strings at review                                                      |
| `contrast-aa`              | `theme.spec.ts`; the table above                                                                                                                                                     |
| `awning-band`              | `awning-band.spec.tsx`                                                                                                                                                               |
| `components-unchanged-api` | at review: `git diff` on `packages/ui/src/components` shows no change to a type, a prop or a `data-testid`, only class strings, comments and the new file; the whole E2E suite green |
| `e2e-green`                | `pnpm e2e`, full log, no existing test file in the diff                                                                                                                              |
| `suite-green`              | the four gate logs                                                                                                                                                                   |

## Worklog

- 2026-11-25 — Mason: read the reading list, both specs, the theme and the components that
  `apps/web-spa` imports; computed the contrast table; wrote this plan. No production code yet.

- 2026-11-25 — Typist, step 1. `packages/ui` has Vitest (hoisted install, so the binary sits at the
  repo root; `pnpm install` ran, lock committed). `theme.spec.ts` written first. Red, before any
  production change: `AssertionError: expected 'OKLCH(0.9851 0 0)' to be '#F7F1E3'` (115 failed).
  A first run failed earlier at collection time because the `@theme` block was read outside an
  `it`; I moved the read inside the tests so the first red is the palette, as planned. Then
  rewrote `globals.css`, removed the Host Grotesk import and dependency. Green: 115 passed.
  Notes: (a) the lock diff also holds three `deprecated:` lines for opentelemetry packages that
  `pnpm install` adds by itself; (b) the spec builds the font name in two parts so the plan's
  `grep -ri "host.grotesk" packages` check does not match the spec itself; (c) the evening block
  only lists tokens that differ from light, the others are inherited (the spec merges them the same
  way); (d) `apps/web-spa/build/` (ignored build output) still holds an old CSS with the word.

- 2026-11-25 — Typist, step 2. `docker ps` showed ports 5434, 1093 and 1043 held only by this
  project's own `grocery-e2e` containers. `e2e:infra` up, then `market-theme.spec.ts` run alone.
  Red on the real target: `expect(box.height).toBeGreaterThanOrEqual(44)` received 32 (login
  button, login field and mode choice, shop search and sort) and 25 (catalog tabs). It also failed
  on the 14 px floor: `Email (12.8px)`, `Téléphone (12.8px)` (the segmented control's
  `text-[0.8rem]`), a failure the plan did not list but step 3 fixes. The colour, font, 18 px body
  and evening cases passed, as the plan expected. The very first run also failed on the colour
  case because the SPA was cold (`auth-login-submit` not found within 10 s); a second run passed
  it. Logs: `scratchpad/step2-red.log` and `step2-red2.log`.

- 2026-11-25 — Typist, step 3. `component-rules.spec.ts` written first. Red: `AssertionError:
expected [ …(5) ] to deeply equal []` for the sizes and sage-text cases, and `["components/app/
page-title.tsx: uppercase"]` for capitals (3 of 4 failed; log `scratchpad/step3-red.log`). Then
  restyled the components in the plan, class strings only. Green: `packages/ui` 119 passed, and
  `market-theme.spec.ts` 8 passed on the real stack (`scratchpad/step3-e2e.log`).
  **Contradiction with the plan, not decided by me beyond the smallest change:** the plan leaves
  `components/layout/` alone and says no `text-primary` in `packages/ui/src`, but
  `layout/Navigation.tsx` (active link) and `primitives/file-upload.tsx` (progress ring, two
  circles) wrote `text-primary`. To make the planned test pass I changed those three class
  strings to `text-foreground` (and `text-foreground/20`). Navigation is imported by nothing in
  `apps/web-spa`. The Architect may prefer to exempt them from the test instead.
  Other small choices to confirm: (a) button `xs` and `sm` keep their old icon sizes (`size-3`,
  `size-3.5`), the plan gave no new ones; (b) `Switch` is not sized in the plan: I made it
  `h-7 w-12` with a `size-5` thumb (default) and `h-5 w-9` (sm), with `border-2 border-border`;
  (c) `Textarea` min height went from `min-h-16` to `min-h-20`, `Checkbox` and `RadioGroup` to
  `size-5`, `AlertDialogMedia` got `border-2 border-border`; (d) the dropdown menu separator
  became `bg-rule`, and accordion item dividers `border-rule`; (e) `combobox`, `hover-card`,
  `input-group` and `input-otp` still hold `ring-1 ring-foreground/10` or `dark:bg-input/30`;
  the plan did not list them, so they only follow the tokens; (f) tooltip text stays `text-xs`
  (now 14 px).

- 2026-11-25 — Typist, step 4. `awning-band.spec.tsx` written first. Red: `Error: Cannot find module
'./awning-band'` (the whole file failed to load). Then wrote `AwningBand`, the `awning`
  utility (three layers as in the plan: stripes, then one half-disc layer per stripe colour) and
  the export in `components/app/index.tsx`. Green: `packages/ui` 125 passed. The band is not
  placed in any layout. Tiny choice: the utility sits just before `@theme inline` in
  `globals.css`; `theme.spec.ts` still reads `:root`, `.dark` and `@theme` correctly.

- 2026-11-25 — Typist, step 5, **not finished; its checkbox stays open.** Logs are in the
  scratchpad (`gate-*.log`). `pnpm lint` exit 0 (warnings only, none in changed files),
  `pnpm typecheck` exit 0, `pnpm build` exit 0. `pnpm test` was red once: `expenses.controller.
e2e-spec.ts`, "rejects a label of 201 characters with 400", received 404 (`gate-test.log`); the
  rerun was green, 125 + 15 + 735 tests (`gate-test-rerun.log`). A known-flaky family does not
  cover this test, so it is reported. `pnpm e2e`, first full run: 148 passed, 2 failed
  (`gate-e2e.log`): `accounting.spec.ts` period filter (`pnl-expenses-total` received 453.50 €
  instead of 0.00 €) and `admin-inventory-stock.spec.ts` weighted average (`page-supplier-order-
detail` not found). Both passed when run alone (`gate-e2e-rerun2.log`). A full rerun was started
  beside that, on the same database, so it is not valid; I stopped it on the Mason's word. Not done:
  a clean full E2E rerun, the screenshots (script `scratchpad/shots.mjs` is ready, no servers
  started), and the E2E stack is down. No existing test file is in the diff.

- 2026-11-25 — Typist, review fixes (Mason's list). Done: destructive menu focus made solid
  (`focus:bg-destructive focus:text-destructive-foreground`, svg follows, tints removed); `input-group`
  root `h-12` and `text-base` on addon and text; `date-picker` `min-h-12`; `command` input `h-12!`;
  `tags` input `h-12`; verb-first helper names in both specs; one shared `styles/read-css-block.ts`
  (`readCssBlock`, with the `start === -1` guard); `AwningBand(): ReactElement`;
  `expectTouchTarget(): Promise<void>`; renders moved into each `it` with `actualHtml` names;
  restating comments removed from `globals.css`. Gates, logs with suffix `-fix`: `@grocery/ui` test
  125 passed, `pnpm lint`, `pnpm typecheck`, `pnpm build`, all exit 0. Not done: the screenshots.
  `e2e:infra` hung (Docker answered `docker ps` with nothing, and a `docker compose -p
grocery-e2e down` that is not mine was running), so no stack and no servers were started. The
  script `scratchpad/shots.mjs` is ready. Step 5 stays open.

## Implementation Checkboxes

- [x] Step 1 — Vitest in `packages/ui`, `theme.spec.ts` red then green, new `globals.css`, Host Grotesk gone
- [x] Step 2 — `market-theme.spec.ts` written and red on the heights
- [x] Step 3 — `component-rules.spec.ts` red then green, components restyled, browser test green
- [x] Step 4 — `awning-band.spec.tsx` red then green, `AwningBand` exported
- [ ] Step 5 — the five gates green, screenshots taken, files formatted

## Notes & Snippets

**Architect's rulings at the plan reading** (Architect, 2026-11-25):

1. **Squash as text.** Ruled: squash stays a fill only, with light text on it, and the test enforcing
   it stays. A later screen that needs squash-coloured text asks for a darker variant first.
2. **Pagination labels.** Ruled: deferred to slice 04 (back office), as optional label props on
   `ListPagination`. An additive optional prop is accepted there; this slice changes no props.
3. **Solid destructive buttons and badges.** Ruled: accepted. The redesign is a change of look, and
   the pale tint fails 4.5:1 in evening mode.
4. **Screens bigger before their layout is redone.** Ruled: accepted. The parent spec already says a
   space not yet redone keeps its old layout with the new theme; it must still work.
5. **Vitest in `packages/ui`.** Ruled: accepted, set up as in `packages/i18n`.

- Usage in `apps/web-spa` (import counts): button 53, input 31, app components 29, skeleton 24,
  badge 23, dialog 14, table 12, segmented control 8, form 6, textarea 5, tabs 3, native select 3,
  label 2, card 2, and one each for tooltip, switch, sidebar, sheet, dropdown menu, checkbox,
  alert dialog, accordion.
- Button sizes used in `apps/web-spa`: `sm` 68 times, `lg`, `icon`, `icon-sm` once each. Raising
  `sm` to 44 px is what makes most of the app's buttons reach the touch target before slices 02 to 04.
- Left for slices 02 to 04 (in `apps/web-spa/app`, out of this slice): one `text-[10px]` with
  `uppercase` in `member-detail-page.tsx`, the other `uppercase` classes, raw `amber-*`,
  `red-500` and `white` colours, and `text-primary` in `add-to-cart-control.tsx`.
- Contrast helper used for the table: relative luminance from sRGB with the 0.03928 threshold,
  ratio `(L1 + 0.05) / (L2 + 0.05)`. The unit test uses the same formula.

## Diff-Review Findings

Written after `code-review`.
