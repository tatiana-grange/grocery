# E-mail templates: one shared layout, every mail in French — work

Created by the Mason at the plan step, 2026-11-26. Spec:
`project-management/tasks/20261126-1519-email-templates.spec.md`.

**Plan:** approved by the Architect on 2026-11-26, with the rulings under "Rulings at the reading".

## Program Design

Read before writing it: the reading list of §C · Reading list of `.agents/project.md` (README,
documentation index, general, backend and constitution pages, `CONTRIBUTING.md`,
`.cursor/rules/`, the journal), the spec and what it links to, the archived automatic supplier
orders task, and `apps/documentation/src/content/docs/core-features/5_email.mdx`.

### Every place the API sends mail today

Thirteen mails, from four places. Nothing else calls `EmailService.sendEmail` or nodemailer
(checked with a search over `apps/api/src`).

| Mail | Sent from | Language today | To |
|---|---|---|---|
| E-mail verification | `auth/auth.module.ts`, `sendVerificationEmail` | English | the new user |
| Password reset | `auth/auth.module.ts`, `sendResetPassword` | English | the user |
| Membership approved | `members/members.service.ts`, `notifyDecision` | English | the member (SMS when no real address) |
| Membership rejected (optional reason) | same | English | same |
| Membership ended (optional reason) | `members/members.service.ts`, `notifyLifecycle` | English | same |
| Membership reactivated | same | English | same |
| Negative balance, to the member | `wallet/member-notice.service.ts` | French | the member |
| Negative balance, to the admins | same | French | each admin |
| Underpaid top-up, to the admins | same | French | each admin |
| Supplier order (CSV attached, referent in copy) | `purchasing/supplier-order-mail.service.ts` | French | the supplier |
| Automatic send summary | `purchasing/supplier-order-notice.service.ts` | French | each admin |
| Send failure alert | same | French | each admin |
| Missed distribution alert | same | French | each admin |

### Files

```
apps/api/src/modules/email/
  email.module.ts                      unchanged
  email.service.ts                     sender display name; inline logo attachment
  email.service.spec.ts                new cases (see step 1)
  email-logo.ts                        EMAIL_LOGO_CID, EMAIL_LOGO_SRC, EMAIL_LOGO_PATH
  email-render.ts                      RenderedEmail type, renderEmail()
  email-templates.ts                   one render function per mail (the seam)
  README.md                            rewritten short: points at 5_email.mdx
  templates/
    static/logo.jpg                    moved from assets/logo.jpg (see decision "logo place")
    _components/email-layout.tsx       the shared layout
    _components/email-button.tsx       the call-to-action link styled as a button
    _components/email-theme.ts         colours and fonts, with their source
    _components/format-euros.ts        "5,00 €" from cents, moved from member-notice.service.ts
    email-samples.ts                   sample data of every template (preview and tests)
    email-verification.tsx
    password-reset.tsx
    membership-approved.tsx
    membership-rejected.tsx
    membership-ended.tsx
    membership-reactivated.tsx
    negative-balance-member.tsx
    negative-balance-admin.tsx
    underpaid-topup-admin.tsx
    supplier-order.tsx
    supplier-order-auto-sent.tsx
    supplier-order-send-failed.tsx
    missed-distribution.tsx
  tests/
    email-templates.spec.ts            renders every template (the criteria tests)
    email-catalogue.ts                 the list of templates with their sample render
apps/api/src/common/html.util.ts       deleted: React escapes, no caller left
```

The `_components` folder starts with `_` and `static` is named `static` because the React Email
preview skips both when it lists templates (read in the CLI source of `react-email` 6.11.16,
`getEmailsDirectoryMetadata`). Only files under `templates/` are `.tsx`.

### React Email in the API

**Packages** (checked on npm on 2026-11-26). `@react-email/components` and the single component
packages are deprecated: the components now ship in `react-email` itself, which also holds the
`email` CLI.

- dependencies: `react-email` `6.11.16` (components), `@react-email/render` `2.3.1` (`render`,
  HTML and plain text), `react` and `react-dom` from `catalog:frontend`.
- devDependencies: `@types/react` from `catalog:frontend`, `@react-email/ui` `6.11.16` (the preview
  app; the CLI refuses a version that differs from `react-email`'s, so both are pinned exact).
- Cost: `react-email` is a runtime dependency and brings the CLI's own dependencies (esbuild,
  tailwindcss, babel parser) into the API image. Next.js comes only with `@react-email/ui`, a
  dev dependency. Accepted: there is no other maintained package for the components.
- `pnpm-workspace.yaml` sets `strictPeerDependencies: true`. If the install fails on a peer of
  Next.js, the Typist stops and reports; no peer rule is added without the Architect.

**How `.tsx` compiles, three tools, one rule: JSX only under `modules/email/templates/`.**

1. `apps/api/tsconfig.json`: add `"jsx": "react-jsx"` (tsc decides by extension, so `.ts` files
   are not affected) and add `.react-email` to `exclude` (the preview writes a Next.js app
   there). `tsc --noEmit` then typechecks the templates.
2. Build and `nest start` (the browser suite runs the API with `nest start`): the Nest CLI's SWC
   builder only picks `.js` and `.ts` files by default (`swc-defaults.js` of `@nestjs/cli`
   11.0.24). `nest-cli.json` sets `"builder": { "type": "swc", "options": { "extensions":
   [".js", ".ts", ".tsx"] } }`. `.swcrc` becomes an array of two configs: the present one with
   `"test": "\\.ts$"`, and a copy with `"test": "modules/email/templates/.+\\.tsx$"`,
   `"parser": { "tsx": true }` and `"transform": { "react": { "runtime": "automatic" } }`. A
   `.tsx` elsewhere matches no config and fails the build.
3. Vitest (`unplugin-swc` 1.5.10): it reads `jsx` from the nearest tsconfig and then parses
   **every** `.ts` file as TSX, which breaks `const fakeCollection = <T>(items: T[]) =>` in
   `purchasing/tests/purchasing.mapper.spec.ts`. So `vitest.config.ts` uses two plugin
   instances: the present one with `exclude: [/node_modules/, /\.tsx$/]` and
   `jsc: { parser: { tsx: false } }` (its options win over the tsconfig ones), and a second one
   with `include: /modules\/email\/templates\/.+\.tsx$/` and
   `jsc: { transform: { react: { runtime: 'automatic' } } }`. Both go in each test project.
4. oxlint and oxfmt read `.tsx` as they are. `.react-email` goes into `.gitignore`, the oxlint
   `ignorePatterns` and the oxfmt ignore list.

Fallback, if the `.swcrc` array does not merge with the Nest CLI's options: `"tsx": true` for all
files in `.swcrc` and `<T,>` in the one test above. The Typist reports before taking it.

### The seam: one render function per mail

```ts
// email-render.ts
export interface RenderedEmail { subject: string; html: string; text: string }
/** Renders a template to HTML and to the plain text derived from that same HTML. */
export async function renderEmail(input: { subject: string; element: ReactElement }): Promise<RenderedEmail>
// html: await render(element); text: await render(element, { plainText: true })

// email-templates.ts, one per mail, e.g.
export function renderPasswordResetEmail(data: PasswordResetEmailData): Promise<RenderedEmail>
```

- The render functions add the brand: `{ cooperativeName: config.cooperative.name, logoSrc:
  EMAIL_LOGO_SRC }`. The templates never import `config` (the preview runs them without the
  API's environment). They are pure components: props in, markup out.
- Each template's props are `{ brand: EmailBrand } & <Mail>EmailData`. The data interface is
  exported from its template file; the default export is the component, with its
  `PreviewProps` set from `email-samples.ts` and the preview brand (`logoSrc:
  '/static/logo.jpg'`).
- The subject is written in the render function. The plain text is derived from the HTML by
  React Email (`html-to-text` with `wordwrap: false`, images skipped, a link written as its
  text followed by its address), so links and figures cannot differ between the two versions.
- The services call the render function, then `EmailService.sendEmail({ to, cc?, subject,
  content: mail.text, html: mail.html, attachments? })`. `EmailOptions` is unchanged.

Data of each template. Dates arrive as French text already formatted by the service that sends
(the services own the Paris time zone); amounts arrive in cents and the template formats them.

| Template | Data |
|---|---|
| `email-verification` | `name`, `url` |
| `password-reset` | `name`, `url` |
| `membership-approved` | `name` |
| `membership-rejected` | `name`, `reason?` |
| `membership-ended` | `name`, `reason?` |
| `membership-reactivated` | `name` |
| `negative-balance-member` | `name` |
| `negative-balance-admin` | `memberName`, `membershipNumber`, `balanceCents` |
| `underpaid-topup-admin` | `memberName`, `membershipNumber`, `requestedCents`, `paidCents`, `topupId` |
| `supplier-order` | `supplierName`, `orderDay`, `lines: { productName, quantity, unit }[]` |
| `supplier-order-auto-sent` | `supplierName`, `distributionDay`, `lineCount`, `orderCount` |
| `supplier-order-send-failed` | `supplierName`, `orderId`, `orderDay?`, `mode`, `reason`, `orderUrl` |
| `missed-distribution` | `supplierName`, `distributionDay` |

### The layout

`EmailLayout({ brand, preview, children })`, from `react-email` components (`Html lang="fr"`,
`Head`, `Preview`, `Body`, `Container`, `Section`, `Img`, `Heading`, `Text`, `Hr`).

- Page background `#f7f1e3`, text `#2b241c`, primary `#4e6b4a` (button, links), accent
  `#ede4d0` (header band and footer rule). Written in `email-theme.ts` with a comment naming
  `packages/ui/src/styles/globals.css`, market look, as their source.
- Titles in the system serif (`Georgia, 'Times New Roman', serif`), text in the system sans
  (`-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`). No web font.
- Header: the logo, `src={brand.logoSrc}`, 120 px wide, `alt={brand.cooperativeName}`, then the
  name in the serif.
- A white card (max 560 px) holds the body.
- Footer, in small muted text: « Message envoyé automatiquement par l'application de
  {cooperativeName}. »
- `EmailButton({ href, children })`: a `Link` styled as a primary button. The account mails also
  print the address under it: « Si le bouton ne fonctionne pas, copiez ce lien dans votre
  navigateur : {url} ».

### French wording

Subjects already in French keep their exact text (the API tests and browser tests compare them).
Bodies already in French keep their sentences, cut into paragraphs. The English ones become:

| Mail | Subject | Body |
|---|---|---|
| Verification | Confirmez votre adresse e-mail | Bonjour {name}, / Pour confirmer votre adresse e-mail, cliquez sur le bouton ci-dessous. / [Confirmer mon adresse] / fallback link / Si vous n'avez pas créé de compte, ignorez ce message. |
| Reset | Réinitialisez votre mot de passe | Bonjour {name}, / Vous avez demandé à changer votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. / [Choisir un nouveau mot de passe] / fallback link / Si vous n'avez rien demandé, ignorez ce message : votre mot de passe reste le même. |
| Approved | Votre adhésion est confirmée | Bonjour {name}, / Votre adhésion à {coop} est confirmée. Vous pouvez maintenant vous connecter. |
| Rejected | Votre demande d'adhésion | Bonjour {name}, / Votre demande d'adhésion à {coop} n'a pas été acceptée. / Motif : {reason} (only when given) |
| Ended | Votre adhésion a pris fin | Bonjour {name}, / Votre adhésion à {coop} a pris fin. / Motif : {reason} (only when given) |
| Reactivated | Votre adhésion est de nouveau active | Bonjour {name}, / Votre adhésion à {coop} est de nouveau active. Vous pouvez vous connecter à nouveau. |

The supplier order says « Voici la commande de {coop} du {orderDay} » and its subject becomes
« Commande de {coop} — {supplierName} »: the hard-coded "coopérative Grocery" goes. The send
failure alert shows a « Voir la commande » link, its address written in full in both versions.

### The cooperative's name

`COOPERATIVE_NAME` in `env.config.ts`, `z.string().min(1).default("Lay'picerie")`, read as
`config.cooperative.name`. Used by the brand and by the sender: `from: "\"<name>\"
<EMAIL_FROM>"`, a string so the existing `from: expect.any(String)` assertions hold; nodemailer
encodes a non-ASCII name itself. Documented in the settings table of `5_email.mdx`; not added to
`.env.example`, the default covers local, tests and the browser suite.

### The logo

- `email-logo.ts`: `EMAIL_LOGO_CID = 'logo@grocery'`, `EMAIL_LOGO_SRC = 'cid:logo@grocery'`,
  `EMAIL_LOGO_PATH = join(__dirname, 'templates', 'static', 'logo.jpg')`.
- `EmailService.sendEmail` appends `{ filename: 'logo.jpg', path: EMAIL_LOGO_PATH, cid:
  EMAIL_LOGO_CID, contentType: 'image/jpeg' }` after the caller's attachments when `html`
  contains `EMAIL_LOGO_SRC`, and only then. The caller's attachments are passed as they are, so
  the CSV is untouched (csv-unchanged), and a mail without the layout gets no logo (the present
  `email.service.spec.ts` cases stay as they are). Nodemailer reads the file at send time and
  puts it in a `multipart/related` part.
- The build copies it: `nest-cli.json` `"assets": [{ "include":
  "modules/email/templates/static/**/*", "outDir": "dist" }]`, `"watchAssets": true`. It lands in
  `dist/modules/email/templates/static/logo.jpg`, beside the compiled `email-logo.js`, and the
  Docker image keeps it (`files: ["dist"]`).
- The text version has no image: React Email skips `img` in plain text.

### The preview

`apps/api/package.json`: `"email:preview": "email dev --dir src/modules/email/templates --port
3090"`, run as `pnpm --filter=api email:preview`, then open `http://localhost:3090`. It lists
every template with its `PreviewProps`, reloads on save, and serves `templates/static/` at
`/static/`, so the logo shows. Port 3090 is free in the repo's settings (API 3000 and 3060,
databases 5112 and 5434, MailDev 1025, 1043, 1080, 1093). Documented in `5_email.mdx`.

### Escaping

React escapes every text child and attribute, so a name holding `<b>` arrives as
`&lt;b&gt;`. The hand-written `escapeHtml` and `common/html.util.ts` go. No template uses
`dangerouslySetInnerHTML`; the review checks it. Note for the tests: React writes an apostrophe as
`&#x27;`, so a phrase with an apostrophe is asserted on the text version, not on the HTML.

### Keeping the present tests green

- `email.service.spec.ts`: present cases unchanged (no layout HTML, so no logo).
- `member-notice.service.spec.ts`, `supplier-order-notice.service.spec.ts`,
  `supplier-order-schedule.service.spec.ts`, `purchasing.controller.e2e-spec.ts`,
  `topup.*.spec.ts`: they read `subject`, `content`, `html`, `to`, `cc` and `attachments` of the
  `sendEmail` call. Subjects and sentences stay the same, `content` is now the derived text,
  the CSV attachment is the same object. Expected to pass unchanged. The member notice test
  asserts the member mail holds no amount and no "correct": the layout carries no figure and no
  such word.
- Browser tests reading MailDev: `auth-reset-password.spec.ts` reads the token from the HTML with
  `reset-password\?token=…`: the link is still there. `wallet-correction.spec.ts` asserts the
  member mail has no `7,00` and no `-7` in text and HTML: the layout carries no figure.
  `admin-purchasing-send-mail.spec.ts`: see the open question "logo in the supplier order
  mail" below; it is the one test this plan expects to fail.

### SMS

`members.service.ts` sends `${subject}: ${body}` by SMS to a member with no real address. The
SMS texts are out of scope, so the SMS keeps its present English text, now held in its own small
helper (`membershipSmsText(outcome, name, reason?)`) since the mail no longer builds a body
string. See the open question "SMS of the membership mails".

### Decisions taken in this plan (the spec left them open)

- **logo place** — the logo moves from `email/assets/logo.jpg` to
  `email/templates/static/logo.jpg`. The React Email preview serves only `<templates
  dir>/static/`, and one file in one place beats a copy. The spec names the old path only in a
  note; the brief named it too, so the Architect may rule otherwise (option kept: leave it in
  `assets/` and accept a preview without the logo).
- **text derived from HTML** — not written by hand, so the two cannot drift.
- **dates as text, amounts as cents** in the template data.
- **logo attached by `EmailService`**, keyed on the `cid:` in the HTML, so no service knows about
  it.
- **SMS unchanged**, English kept (see the question).

### Test order and first failing test per step

Each step: write the named test file first, run it red, write the red log name and its error
line in the worklog, then the production files.

1. **Toolchain, layout, account mails.** First failing test:
   `email/tests/email-templates.spec.ts` with the catalogue holding `email-verification` and
   `password-reset`. Cases: every catalogue template renders; the templates folder and the
   catalogue list the same names (a new `.tsx` without an entry fails); subject, text and HTML
   hold none of "Hello", "your", "please", "Reason" (case-insensitive, whole words); every
   `href` of the HTML appears in the text; the HTML shows `cid:logo@grocery` and the text holds
   no `cid:`; the text shows "Lay'picerie"; the reset and verification links are in both
   versions. Red: the template modules do not exist. Then `email.service.spec.ts` new cases:
   the sender is `"Lay'picerie" <…>`; a layout HTML gets the logo attachment after the CSV; an
   HTML without the cid gets none. Then the production files: dependencies, tsconfig, `.swcrc`,
   `nest-cli.json`, `vitest.config.ts`, `COOPERATIVE_NAME`, logo move, `email-logo.ts`, theme,
   layout, button, the two templates, samples, `email-render.ts`, `email-templates.ts`,
   `EmailService`, `auth.module.ts`. Checks before the commit: `pnpm --filter=api test`,
   `pnpm --filter=api typecheck`, `pnpm --filter=api build`, then
   `ls apps/api/dist/modules/email/templates/static/logo.jpg` and
   `node -e "require('./apps/api/dist/modules/email/templates/password-reset.js')"`, and
   `pnpm lint`.
2. **Membership mails.** First failing test: four catalogue entries in
   `email-templates.spec.ts`, plus the escaped case (a member named `<b>Mia</b>` and a reason
   `<script>x</script>` show as `&lt;b&gt;` and `&lt;script&gt;` in the HTML, never as tags) and
   the reason shown only when given. Red: the modules do not exist. Then the four templates and
   `members.service.ts` (mail through the templates, SMS through `membershipSmsText`).
3. **Wallet notices.** First failing test: three catalogue entries, plus the figures case (the
   negative balance shows « -5,00 € » and the underpaid top-up « 15,00 € » and « 20,00 € » in
   both versions; the member mail holds no figure). Red: missing modules. Then the templates,
   `format-euros.ts` and `member-notice.service.ts`. `member-notice.service.spec.ts` must stay
   green unchanged.
4. **Purchasing mails.** First failing test: four catalogue entries, plus the supplier order
   lists every line in both versions, a supplier named `<b>Moulin</b>` is escaped, and the send
   failure link is in both versions. Red: missing modules. Then the templates and the two
   purchasing services; `html.util.ts` deleted. `purchasing.controller.e2e-spec.ts` (CSV
   attachment `toEqual`) and the notice and schedule specs must stay green unchanged.
5. **Preview and documentation.** No unit test fits a dev server: the check is to run
   `pnpm --filter=api email:preview`, fetch `http://localhost:3090` and one template page, see
   the thirteen templates and the logo, and stop it; the worklog records it. Then `.gitignore`,
   oxlint and oxfmt ignores, `5_email.mdx` (templates, setting, preview, inline logo),
   `email/README.md`.
6. **Gates.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and, after `docker ps`,
   `pnpm e2e`, each in the background with its full log, read in full.

### Open questions for the Architect

1. **Logo in the supplier order mail.**
   - Fact: MailDev lists inline (`cid:`) images among a message's `attachments` (MailDev 2.2.1,
     `lib/mailserver.js`, which only filters them by `contentId` to rewrite the HTML).
     Nodemailer puts the inline logo in the `multipart/related` part, before the CSV in the
     message, so it likely comes first.
   - Problem: `admin-purchasing-send-mail.spec.ts` asserts `mail.attachments` has length 1 and
     reads attachment 0 as the CSV. With the logo, it will fail, and the project rule forbids
     editing a browser test to make it pass without the human.
   - Options: (a) the human allows changing that test to look for the CSV among the attachments
     that have no `contentId` (the test keeps its intent: one CSV, with the product in it);
     (b) the supplier order mail goes without the logo, against the `logo` criterion;
     (c) the logo as a web address, against the spec (no public address).
   - Recommendation: (a). The Typist runs that test at step 4 to confirm the failure before
     anyone changes it.
2. **SMS of the membership mails.**
   - Fact: the same subject and body feed the SMS sent to a member without a real address.
   - Problem: the spec puts the SMS texts out of scope, so they stay English while the mails
     turn French.
   - Options: (a) keep the SMS text exactly as today (this plan); (b) give the SMS the French
     sentences of the mails, one line each, at no extra cost.
   - Recommendation: (a) as the spec says, and a follow-up task for the SMS texts, unless the
     human says (b) now.
3. **Logo place.** See the decision "logo place" above: confirm the move to
   `templates/static/`.

## Worklog

- 2026-11-26, Mason: read the reading list, the spec, the archived automatic supplier orders
  task and the email page; found the thirteen mails; checked the React Email packages on npm and
  read the CLI, render and MailDev sources to settle the toolchain and the attachment question;
  wrote this plan. No production code.

## Implementation Checkboxes

- [ ] Step 1 — toolchain, layout, account mails
- [ ] Step 2 — membership mails
- [ ] Step 3 — wallet notices
- [ ] Step 4 — purchasing mails
- [ ] Step 5 — preview and documentation
- [ ] Step 6 — gates

## Notes & Snippets

- `unplugin-swc` 1.5.10, `dist/index.js`: when the tsconfig has `jsx`, it sets `parser.tsx =
  true` for every `.ts` file and merges `options.jsc` over its own with `defu`, so the plugin
  options win.
- `@nestjs/cli` 11.0.24, `lib/compiler/defaults/swc-defaults.js`: `extensions: ['.js', '.ts']`,
  `swcrc: true`, builder options spread over the CLI options.
- `@react-email/render` 2.3.1: `render(node, { plainText: true })` uses `html-to-text` with
  `wordwrap: false`, skips `img` and `[data-skip-in-text=true]`, writes links without brackets.
- `react-email` CLI: `getUiLocation` refuses an `@react-email/ui` whose version differs from its
  own; templates are `.tsx`/`.jsx`/`.js` files with a default export; `_*` and `static` folders
  are skipped.

## Diff-Review Findings

## Rulings at the reading (Architect, 2026-11-26)

- **Logo and the supplier order browser test (human's word):** the supplier order mail is sent
  without the logo; its CSV stays the only attachment and `admin-purchasing-send-mail.spec.ts`
  is not edited. Every other HTML mail carries the logo. The spec's `logo` criterion is amended.
- **Membership SMS (human's word):** the four membership SMS turn French in this task, with the
  short form of the French mail sentences. The spec's scope and `all-french` are amended. Drop
  the helper that kept the English SMS text.
- **Logo location:** option (a). The Architect moved the file to
  `apps/api/src/modules/email/templates/static/logo.jpg` so the preview shows it.
