---
name: grocery-feature-review
description: Review the code of a Spec Kit feature with five agents, one per check - project conventions, i18n FR/EN, duplication and reuse, the feature's business rules and their tests, constitution principles and security. Runs after `speckit-implement` through the `after_implement` hook, or when the user asks to "review the feature", "relire la feature" or "relire l'implémentation".
---

# Feature review

Review all the code written for the current Spec Kit feature. This skill reports first. It
changes code only for the points the user picks.

The review leaves a record in `<feature_directory>/review.md`: the files reviewed with their
hash, and the points found. A later review only rereads the files changed since.

## 1. Find the feature

1. Read `.specify/feature.json`. Its `feature_directory` key gives the feature folder. If it
   is missing, ask the user for the folder.
2. List the changed files with the command below. It lists files added or modified since the
   branch left `origin/staging`, committed or not, without deleted files.

   ```bash
   { git diff --name-only --diff-filter=d "$(git merge-base origin/staging HEAD)"; git ls-files --others --exclude-standard; } | sort -u
   ```

   On a stacked branch, use the parent feature branch instead of `origin/staging`. If the user
   gives another starting point (a commit, a branch), use that.

   Then drop the generated files — `packages/openapi-generator/client/**`,
   `packages/openapi-generator/tmp/**`, `apps/api/src/modules/db/migrations/.snapshot-*.json`,
   `apps/documentation/INDEX.md`, `pnpm-lock.yaml` — every Markdown/MDX file, the Spec Kit
   folder, and images. What remains are the **code files**, including the locale JSON files
   and the migrations.

3. Pick what to review:
   - **Full review**: when `<feature_directory>/review.md` does not exist, or when the user
     asks for it. Review every code file.
   - **Partial review**: when `review.md` exists. Only review the code files missing from its
     "Files reviewed" list, or whose `git hash-object <path>` differs from the recorded hash.
     If there are none, the review is up to date: say so and stop. Tell the user it is a
     partial review, and which files it covers.

If there are no code files, stop and say so.

## 2. Start five agents

Start five `general-purpose` agents in parallel, in a single message. Each checks one thing
only, on the files picked in step 1. In a partial review, `<list>` holds only those files.

Give each agent the shared part below, followed by its check.

### Shared part

```text
You review the code of the feature described in <feature_directory>, for ONE check only
(below). Do not modify any file.

Changed files of the feature:
<list>

Read each changed file in full, and its diff with `git diff <base> -- <file>` (an untracked
file is entirely new). Only review code the feature added or changed.

Only report real problems you can point at, with a file and a line.

Answer in this format, and nothing else:
- <file>:<line> — <the problem, one sentence>. Fix: <one sentence>.
If you found nothing, write "No points."
```

### Check 1: conventions

```text
First read apps/documentation/src/content/docs/references/general.mdx, backend.mdx and
frontend.mdx, and the "Rules" and "Active Technologies" parts of CLAUDE.md.

Check that the code follows them:
- API: one NestJS module per domain with its controller, service, entities, contracts,
  mapper and tests folders; business rules in services, not controllers; Zod contracts with
  `.meta()`; routes through `@TypedRoute` / `@TypedBody` / `@TypedParam`; entities mapped to
  contracts through the module mapper; errors as Nest exceptions, and refusals the frontend
  must recognise as 409 with an explicit `code`.
- Database: every schema change has a MikroORM migration and the updated
  `.snapshot-grocery.json`; no `db:fresh:seed` in scripts or docs aimed at shared databases.
- Frontend: feature code under apps/web-spa/app/features/<feature>/ (components, utils);
  data through the generated client and TanStack Query options; no direct fetch.
- TypeScript: no `any`, no cast to silence the compiler, no non-null assertion without a
  reason.
- Naming conventions from general.mdx; code, comments and test names in English.
- A new environment variable is in the matching `.env.example` files and the app still
  starts without it, or fails with a clear message.
For each point, quote the rule you rely on. No style opinions beyond these documents.
```

### Check 2: i18n FR/EN

```text
Read the i18n rule in frontend.mdx ("Use @grocery/i18n ... no hardcoded strings") and
packages/i18n/README.md. Translations live in
apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json and
apps/web-spa/app/lib/i18n/locales/en/common.locales.en.json, as nested keys.

- Report every user-visible string hardcoded in a component, page, toast, dialog or error
  message, in any language: it must go through `t(...)`.
- For each key used in the changed code (`t('a.b.c')`), check it exists in BOTH the fr and
  en files.
- For each changed locale file, compare its keys with the other language: report every key
  present on one side only.
- French: the cooperative's vocabulary (adhérent, distribution, précommande, solde…), the
  same tone as the existing strings. English: same meaning as the French, not a word-for-word
  translation.
- API error codes shown to the user are mapped to a translated message, not displayed raw.
```

### Check 3: duplication

```text
Search the repository (grep) for code that already does what the feature's code does,
within the feature or elsewhere.
- UI: check that packages/ui components (`@grocery/ui`) and
  apps/web-spa/app/features/common are used instead of new markup or a new component.
- API: check reuse of existing services and helpers (members, catalog, orders, inventory,
  wallet modules; shared pagination, filters and price helpers) instead of a second copy.
- Contracts: check that existing Zod schemas are reused or extended rather than redefined.
- Tests: check that existing factories, seeders (apps/api/src/seeders, e2e.fixtures.ts) and
  Playwright fixtures (apps/web-spa-e2e/fixtures.ts) are reused.
For each point, give the path of the existing code to reuse.
```

### Check 4: business rules and tests

```text
Read <feature_directory>/spec.md, plan.md, tasks.md, and data-model.md, contracts/,
research.md and quickstart.md when they exist.
Compare the code with them: functional requirements (FR-xxx), acceptance scenarios, edge
cases, contracts. Report what is missing, what is wrong, or what was added without the spec
asking for it. Also report checked tasks (- [X]) whose code you cannot find.

Then check the spec is covered by tests. Read the "Testing" sections of general.mdx and
backend.mdx, and apps/documentation/src/content/docs/guides/api-testing.mdx and
web-spa-e2e.mdx.
- Every business rule, edge case (validation, refusal, limit) and access right has a test:
  a service unit spec or a controller e2e spec under the module's tests/ folder.
- Every user story has a Playwright test of its primary flow in apps/web-spa-e2e/tests/.
- No existing E2E test was edited, skipped or deleted to make it pass.
Report each scenario or edge case without a test, and each test that does not check what the
spec says. Name the test file where it belongs.

For each point, name the requirement, scenario or task concerned (FR-xxx, scenario, Txxx).
```

### Check 5: constitution and security

```text
Read .specify/memory/constitution.md.

Check the code respects its principles, in particular:
- money and stock ledgers are write-once: no update or delete of a ledger row; a correction
  is a new reversing row;
- multi-row writes that must succeed together run in one transaction, and reads that a
  refusal depends on happen inside it (locks where two tills could race);
- amounts are computed from stored snapshots where the spec says so, never from today's
  price;
- schema changes only through migrations.

Then security:
- every route has the right guard for its role (member, distributor, admin), and a member
  can only reach their own data — resolved from the session, never from a client-supplied id;
- every input goes through a Zod contract; no raw SQL built from user input (parameters
  only);
- no secret, token or personal data in the repository, in logs, or in error messages;
- no user input rendered as HTML without escaping.
For each point, quote the principle or rule concerned.
```

## 3. Report

When the five agents are done, write the merged result to `<feature_directory>/review.md`.

- **Full review**: overwrite the file.
- **Partial review**: keep the file. Add new points at the end of their section, keep the old
  ones as they are, and add or update the reviewed files and their hashes under "Files
  reviewed".

Use this layout:

````markdown
# Code review

## Files reviewed

```text
<git hash-object of the file>  <path>
...
```

## Business rules and tests

- [ ] <file>:<line> — <the problem>. Fix: <the fix>.

## Constitution and security

## Duplication

## Conventions

## i18n
````

- List every code file reviewed with its `git hash-object <path>`.
- Every point is an open checkbox (`- [ ]`). A section without points says "No points."

Then give the user a short summary in plain words: the number of points per check, the most
serious first (security and business rules before the rest). Ask which points to fix. Fix
nothing before the answer.

## 4. Close the points

Every point must end closed:

- **Fixed**: once the fix is done, check it (`- [x]`).
- **Not fixed**: when the user decides to leave it, check it and add
  `Not fixed: <the user's reason>.` at the end of the line.

After the fixes, run `pnpm lint`, `pnpm typecheck` and `pnpm test`, and report the result.
Run `pnpm e2e` too when a fix touched the frontend or an API route the SPA calls. Update the
hashes under "Files reviewed" for the modified files. Changes made outside these fixes need
a new review: run this skill again, it only rereads the files changed since.

Commit the fixes and `review.md` together in one commit, as `fix(<scope>): 🐛 apply the
feature review` (see `CONTRIBUTING.md`).
