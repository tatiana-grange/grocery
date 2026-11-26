# E-mail templates: one shared layout, every mail in French

**Status:** done — closed by the Mason on 2026-11-26; approved by the human on 2026-11-26 (name and logo given)

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

Every e-mail the API sends is a string written inline in a service, wrapped at best in one
`<p>`. There is no layout, no colours, no name of the cooperative, and several mails are still
in English, left from the boilerplate. Production will send through Resend over SMTP (see
`apps/documentation/src/content/docs/core-features/5_email.mdx`, "Production: Resend"), and
the automatic supplier orders add mails that go outside the cooperative, to suppliers.

Decided by the human on 2026-11-26: templates live in the code, written with React Email, and
still leave through SMTP, so the provider can change without rewriting them. Resend's own
dashboard templates are not used.

This task starts after the automatic supplier orders task
(`20261126-1505-automatic-supplier-orders`), on a branch stacked on
`feat/supplier-order-schedule`, because it rewrites the mails that task adds.

## Scope

**Included:**

- React Email in the API, with one shared layout: the cooperative's logo and name
  (Lay'picerie) in the header, the market look's colours, a footer saying who sent it and that the mail is automatic.
- Every mail the API sends today rewritten on that layout, in French:
  - account: e-mail verification, password reset (`auth.module.ts`, English today);
  - membership: approved, rejected, ended, reactivated (`members.service.ts`, English today);
  - wallet: negative balance to the member and to the admins, underpaid top-up to the admins
    (`member-notice.service.ts`);
  - purchasing: the order to the supplier, the admin summary, the send-failure alert and the
    missed-distribution alert (from the automatic supplier orders task).
- Each mail keeps a plain-text version beside the HTML.
- A preview of every template in the browser, by one command, with sample data.
- The cooperative's name in one setting, read by the layout.

**Not Included:**

- Templates edited by admins from the app.
- Any change to who receives which mail, or when.
- ~~The SMS texts.~~ The other SMS texts (sign-in codes). (Human, 2026-11-26: the four
  membership SMS, which reuse the membership mails' text, turn French in this task.)

## Acceptance Criteria

- [x] **one-layout** — Every mail the API sends goes through the shared layout. A test lists
  the templates and renders each one with sample data.
- [x] **all-french** — No mail subject or body is in English, and neither are the four
  membership SMS (human, 2026-11-26). Checked by a test over the rendered
  templates for the English words the old mails used ("Hello", "your", "please").
- [x] **text-and-html** — Every sent mail carries both a text and an HTML version, and the text
  version holds the same links and figures as the HTML.
- [x] **escaped** — A name or a reason typed by a person (member name, supplier name, refusal
  reason) is escaped in the HTML: a name holding `<b>` shows as text.
- [x] **links-kept** — The verification and reset mails still carry their working link; the
  existing auth tests and browser tests that read those mails in MailDev stay green.
- [x] **cooperative-name** — The header and the sender name show the cooperative's name from
  the setting, "Lay'picerie" by default.
- [ ] ~~**logo** — Every HTML mail shows the logo in its header, embedded in the mail itself (an
  inline attachment referenced by `cid:`), so it shows without loading anything from the web.
  The text version does not carry it.~~
- [x] **logo** — Every HTML mail except the order to the supplier shows the logo in its header,
  embedded in the mail itself (an inline attachment referenced by `cid:`). The supplier order
  mail carries the CSV as its only attachment and no logo. The text version never carries it.
  (Human, 2026-11-26: the browser test of the supplier order mail stays unchanged.)
- [x] **preview** — One documented command opens every template in the browser.
- [x] **csv-unchanged** — The supplier order mail still attaches the same CSV, byte for byte.
- [x] **suite-green** — lint, typecheck, API tests, build and the browser suite pass.

## Seams

- **Template rendering** — one function per mail: it takes typed data and returns
  `{ subject, html, text }`. Tested by rendering, with no mail server.
- **The services that send** — they call the template, then `EmailService.sendEmail`
  unchanged in shape. Their tests keep asserting who gets what.

## Architecture

**System design:** a `templates/` folder in the email module holds the layout and one `.tsx`
file per mail. React Email renders them to HTML and text on the server; nothing reaches the
browser app. The services that send mail stop writing text inline and call their template.
The colours are copied from the market look of `packages/ui/src/styles/globals.css` (page
`#f7f1e3`, text `#2b241c`, primary `#4e6b4a`, accent `#ede4d0`): mail clients cannot read CSS
variables, so the values are written in the layout, with a comment naming their source.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

- Mail fonts: the system serif for titles and the system sans for text. Web fonts are not
  loaded, since many mail clients block them.
- The cooperative's name is a new setting in `env.config.ts`, also used as the sender's display
  name (`"<name>" <EMAIL_FROM>`).
- The API's TypeScript setup must accept `.tsx` in the email module only; the plan says how.

## Testing Strategy

- Render each template with sample data: French text, the escaped name, the link present in
  both versions.
- The existing tests of the sending services stay green; their expected text is updated where
  the wording changed.
- The browser tests that read mails in MailDev (account verification, supplier order) stay
  green.

## Slices & Dependencies

- **Sizing:** one task, one pass.
- **Blocked by:** the automatic supplier orders task, until it is closed.

## Deliverables

- [x] Layout and templates, with the preview command
- [x] Every sending service moved to its template
- [x] The email documentation page updated (templates, preview)
- [x] Journal entry

## References

- `apps/documentation/src/content/docs/core-features/5_email.mdx` — the SMTP settings and the
  choice of Resend.
- `project-management/tasks/20261126-1505-automatic-supplier-orders.spec.md` — the supplier
  and admin mails this task restyles.

## Notes

- 2026-11-26, human: the name is "Lay'picerie". The logo is the association's own
  ("A Lay'picerie, épicerie associative & participative"). The Architect cropped it square and
  resized it to 480 × 480 for mails: `apps/api/src/modules/email/assets/logo.jpg` (48 KB). The
  layout shows it at about 120 px wide. It is sent as an inline attachment because Gmail
  blocks images written into the HTML as data, and the app has no public address to host it
  yet.

## Retrospective

Retro proposals from the Mason, 2026-11-26. Sources: this session, the Typist's and the two
reviewers' reports, the work document and the diff. Nothing applied; each waits for its owner.

1. **Automated checks, high — the API e2e project is outside `pnpm test`.** `pnpm test` ran 47
   API files (the unit project) and none of the 14 `*.e2e-spec.ts` files (406 tests), which the
   Typist had to run with `vitest --project e2e`. The gate in §F · Gate commands of
   `.agents/project.md` therefore misses the API route tests. Proposal: find why the e2e project
   does not run from `pnpm test` and fix the script, or name the second command in §F. Owner:
   the human.
2. **AGENTS.md, medium — four more browser tests fail under load.** In the full `pnpm e2e` run,
   `account.spec.ts` (account page), `admin-inventory-stock.spec.ts` (weighted average) and
   `wallet-topup.spec.ts` (refused payment) failed with the known `accounting.spec.ts` one, and
   all four passed alone. Proposal: add the first three to "Known flaky tests" in `AGENTS.md`,
   or open a task to find the shared cause. Owner: the human.
3. **Coding standards, medium — the general guideline rules the Typist missed.** The standards
   reviewer found JSDoc, verb-first names, RO-RO and return types missing across new files: all
   in `general.mdx`, none caught by a tool. Proposal: add these four lines to the Typist brief in
   the project rules of `AGENTS.md`, or turn on oxlint's
   `typescript/explicit-function-return-type` for `apps/api`. Owner: the human.
4. **Navigation, low — JSX in the API.** The plan's two-entry `.swcrc` does not work with the
   Nest CLI (`unknown field 0`); the build now parses every `.ts` file as TSX, and only Vitest
   keeps TSX inside `modules/email/templates/`. Proposal: a short "JSX in the API" paragraph in
   `backend.mdx` saying where `.tsx` is allowed and why the two Vitest plugins exist. Owner: the
   human.
5. **Plan step, low — prove a tooling change before the plan reading.** The `.swcrc` choice was
   read from source, not run, and failed at step 1. Proposal: in the project rules of
   `AGENTS.md`, a plan that changes build or test tooling runs a throwaway check of it before it
   goes to the Architect. Owner: the human.
