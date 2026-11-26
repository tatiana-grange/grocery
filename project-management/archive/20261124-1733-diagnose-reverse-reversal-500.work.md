# Diagnose: reversing a reversal answered 500 once — work

Created by the Mason at the plan step, 2026-11-24. Spec:
`project-management/tasks/20261124-1733-diagnose-reverse-reversal-500.spec.md`.

**Plan:** approved by the Architect, 2026-11-24, with the corrections below.

## Program Design

### The cause, in two sentences

Supertest starts the test app on a random port open on all addresses, then sends each request
to `127.0.0.1` on that port. macOS can hand out a port that another program already holds on
`127.0.0.1` only, and the request then goes to that other program. On this machine those are
other local processes that answer "404 not found".

In the failing test, the first reversal went to such a program and got a 404 with no `id`. The
test does not check that first answer, so it sent the second reversal to
`/distribution/handovers/undefined/reversal`. The route accepts any string as the id, Postgres
refuses `undefined` as a UUID, and the app answers 500. The 500 is a symptom two steps away
from the cause.

### Fix plan

The regression test comes first, red, before any change to the helper.

1. **Regression test, red first.** New file `apps/api/src/test/helpers/test-app.helper.e2e-spec.ts`
   (picked up by the `e2e` Vitest project), one test: "the test app owns its port on
   127.0.0.1". It builds an app with `initializeTestApp` and checks three things:
   - the HTTP server is already listening, on address `127.0.0.1`;
   - a second server that tries to bind `127.0.0.1` on that same port is refused
     (`EADDRINUSE`), so no other program can sit in front of the app;
   - a request through `createRequest` reaches the app (an anonymous call to a staff route
     answers the app's own 401, not a stranger's 404).

   Red today: after `initializeTestApp` the server is not listening at all, so the first
   check fails. I could not find a test that goes red on the exact collision every time: the
   random port is chosen by the kernel inside supertest, and a test cannot force an unlucky
   draw. The test therefore pins the rule that removes the collision. The harness below is
   the evidence that the rule is what matters.

2. **Fix.** In `initializeTestApp` (`apps/api/src/test/helpers/test-app.helper.ts`), after
   `app.init()`, call `await app.listen(0, '127.0.0.1')`, with a comment that says why. When
   the server already listens, supertest uses its port and no longer starts or stops the
   server around each request. `createRequest` does not change. The `afterEach` of
   `test.e2e-setup.ts` already calls `app.close()`, which also stops the listening server.

3. **Green and loops.** The regression test goes green. Then the real test "refuses reversing
   a reversal" runs alone 25 times, and the full API suite (`pnpm --filter=api test`) runs
   three times, each with its full log read. Then the three gates of the spec: `pnpm lint`,
   `pnpm typecheck`, `pnpm test`. No SPA code changes, so no `pnpm build` or `pnpm e2e`.

4. **Docs.** One paragraph in `apps/documentation/src/content/docs/guides/api-testing.mdx` (the
   guide to API tests): the test app listens on `127.0.0.1` on purpose, and why.

### Questions for the Architect

- **Sharpen the test?** Add `expect(reversal.status).toBe(201)` after the first reversal in
  "refuses reversing a reversal", so a failed first call shows as itself and not as a
  misleading 500 on the second. It makes the test stricter; it hides nothing. The rule "do not
  edit the test" in `AGENTS.md` ("Known flaky tests") is about hiding flakiness, so I ask
  rather than assume. My recommendation: yes.
- **The 500 on a malformed id.** The reversal route reads `handoverId` with `z.string()`, so
  any id that is not a UUID answers 500 instead of 400 or 404. 46 route params in the API do
  the same; 12 use a UUID check. This is a real defect, but it is not the cause, and fixing it
  means touching many routes. My recommendation: a separate task, not this one.
- **The known-flaky rule.** The same cause explains the other odd failures seen in full runs
  (below): a top-up 404, a participation list with no `data`, a wallet `ECONNRESET`. If the
  fix holds, the "Known flaky tests" paragraph of `AGENTS.md` and the advice to make parallel
  calls sequential are probably out of date. I would propose that through `retro` at the
  close, not change it now.

## Corrections at the reading

Written and signed by the Architect, 2026-11-24.

1. **Stricter test: yes.** Add the check that the first reversal answers 201. The rule in
   `AGENTS.md`, "Known flaky tests", forbids editing a flaky test to hide a failure; this check
   does the opposite, it makes a failed first call show as itself. Reported to the human.
2. **The 500 on an id that is not a UUID: a separate task.** Not fixed here. Write it in the
   close report as a proposal, with the counts (46 plain string params, 12 UUID checks).
3. **The "Known flaky tests" note: through `retro` at the close**, once the three full runs are
   green, with the evidence.
4. **Teardown.** Check that the test app is closed after each file now that it listens, so no
   port or handle stays open (`vitest` must not hang).

Go ahead with the regression test.

## Worklog

### 2026-11-24 — diagnosis

Read: `AGENTS.md`, `.agents/discipline.md`, the Mason part of `.agents/workflow.md`, the spec,
the work template, the `diagnosing-bugs` skill, the lot 7 worklog line on
`feat/accounting-exports` (it records `ECONNRESET` on four parallel supertest calls). No code
differs between this branch and `feat/accounting-exports` in the distribution, wallet,
inventory and test-helper folders, so this branch is a fair place to reproduce.

What I tried, in order:

1. **The test alone, 25 times in a row** (Vitest, `e2e` project, `-t "refuses reversing a
reversal"`). 25 green out of 25.
2. **A throwaway probe spec** in the distribution tests folder, tagged `[DEBUG-r500]`,
   deleted before this commit. It recorded the status of all three calls (handover, first
   reversal, second reversal).
   - Sending the id `undefined` to the reversal route: **500**, server log
     `DriverException: invalid input syntax for type uuid: "undefined"`. This is the exact
     symptom of the failing run, and it only needs the first reversal to come back without an
     `id`.
   - 30 rounds in sequence in one test, and 30 rounds with two parallel side calls on the
     one-connection app: all 201 / 201 / 409.
3. **The whole API e2e project with the probe inside** (60 rounds per probe test). Probe
   rounds all green. A top-up test failed with **404 instead of 201** — a route that exists.
4. **40 copies of the exact real test** (one fresh app and database each) inside the whole API
   suite (unit and e2e, as `pnpm test` runs it), three times. 119 green, and **one copy got
   201 / 201 / 404**: the second reversal answered "not found" for a reversal the app had
   just created and returned with its id. Same family as the top-up 404.
5. **80 copies, three more full runs, with inspection on any miss** (look the row up through
   a separate connection, now and after 500 ms; compare the database names). The copies were
   240 green this time, but two other tests failed: a participation test got a response with
   no `data`, and a wallet test got `ECONNRESET`. Three tests, three wrong answers for things
   that exist: the problem sits below the app.
6. **How supertest reaches the app.** `supertest/lib/test.js`, `serverAddress`: when the
   server is not listening, it calls `listen(0)` (all addresses), then builds the URL
   `http://127.0.0.1:<port>`, and closes the server after each request. `lsof` shows several
   long-lived local processes holding ports in the random range on `127.0.0.1` only.
7. **Port checks, outside the app** (scratch scripts, no repo change):
   - A server on all addresses _can_ bind a port another socket holds on `127.0.0.1`, and a
     request to `127.0.0.1` then reaches the other socket.
   - Within one process, the kernel never handed a random port that collided (0 of 5,000 in
     each direction).
8. **The harness that went red** (code in Notes & Snippets): a new plain HTTP server per
   "test", three sequential supertest calls, close; each server stamps its replies.
   - Run 1, 9,000 calls: 2 answered by a stranger, 1 `ECONNRESET`.
   - Run 2, 18,000 calls: 4 answered by a stranger, 2 `ECONNRESET`. Every stranger reply was
     `404`, body `not found`, `text/plain`, and `lsof` named the holder of the port at that
     moment: a local process listening on `127.0.0.1:60835` or `127.0.0.1:50186` (other
     Claude Code processes on this Mac, PIDs 75595 and 45447).
   - **Same harness, server started first with `listen(0, '127.0.0.1')`**: 18,000 calls,
     0 strangers, 0 `ECONNRESET`.

Why this is the cause of the 500, not a neighbour: a stranger's 404 has no JSON body, so
`reversal.body.id` is `undefined`; the second call then hits the route with `undefined`, and
step 2 shows that answers 500 with the uuid error. The probe's 201 / 201 / 404 is the same
collision landing on the second call instead of the first. How often it happens depends on
how many programs hold ports on `127.0.0.1` on the machine, which explains "fails once in a
full run, passes on the rerun".

Cleanup: the probe spec is deleted; `grep -rn "DEBUG-r500" apps` finds nothing. The scratch
scripts live outside the repo.

### 2026-11-24 — fix

Typed by the Mason, not a Typist: the change is a few lines in one helper and one test, which
is the "retouch of a few lines" exception in `.agents/workflow.md` (step 5, Code).

- **Plan revision.** The e2e Vitest project did not find the new spec: its include pattern
  `../**/*.e2e-spec.ts` does not reach back into its own root, `src/test`. Added
  `**/*.e2e-spec.ts` to the e2e include in `apps/api/vitest.config.ts`, with a comment. The
  project now finds 11 files: the 10 it had, plus the new one, no duplicate.
- **Red.** `test-app.helper.e2e-spec.ts` failed on its first check: `expected undefined to be
'127.0.0.1'` (the server was not listening after setup).
- **Fix.** `await app.listen(0, '127.0.0.1')` after `app.init()` in `initializeTestApp`, with
  the reason in a comment. **Green.**
- **Stricter test** (correction 1): `expect(reversal.status).toBe(201)` after the first reversal
  in "refuses reversing a reversal".
- **Teardown** (correction 4). Every caller of `initializeTestApp` (ten spec files and the new
  one) puts its app in `context.app`, which the e2e `afterEach` closes; the top-up spec does it
  in each of its seven `beforeEach`. Proof at run time: a temporary tagged line in that
  `afterEach` recorded, for one full API run, whether the server still listened after
  `app.close()`. Result: 311 apps, 311 closed, none listening; the run exited on its own,
  605 of 605 green. The line was removed and the file restored to the committed version.
- **Loops.** "Refuses reversing a reversal" alone: 25 green of 25. Full API suite
  (`vitest run`, unit and e2e): three runs in a row, 605 of 605 green each, full logs read;
  the only error lines are from tests that check error paths on purpose (top-up mismatch,
  email connection failure).
- **Gates.** `pnpm lint` exit 0 (warnings only, none in the changed files), `pnpm typecheck`
  exit 0, `pnpm test` exit 0 (API 605 of 605, i18n 15 of 15). No SPA code changed, so no
  `pnpm build` or `pnpm e2e`. The docs change edits a page body, not a front matter, so the
  documentation build was not run.
- Commits: `2e5e23f` (fix, regression test, stricter test, Vitest include), `8714bae` (API
  testing guide paragraph).

### 2026-11-25 — close

Done by the Architect, Docker answering again. The human confirmed the amended criterion.

- The reworked regression test and the distribution tests: 62 of 62 green.
- `pnpm test`: exit 0, API 605 of 605, i18n 15 of 15. Full log read; the only error lines come
  from tests that check error paths on purpose (negative balance notice, email connection).
- Criteria ticked, documents archived, journal entry written. Retro proposals are in the spec.

## Implementation Checkboxes

- [x] Repeatable check that goes red (the harness: about 1 call in 4,500 answered by a
      stranger, on this machine)
- [x] Cause named, with evidence
- [x] Regression test written and seen red
- [x] Fix in `initializeTestApp`, regression test green
- [x] Real test looped 25 times, full API suite run three times, logs read
- [x] Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- [x] API testing guide paragraph
- [x] `code-review` on the diff since `origin/staging`, findings recorded
- [x] Reworked regression test and `pnpm test` rerun after the review edits
- [x] Close: criteria ticked, documents archived, journal entry, `retro`

## Notes & Snippets

The harness, as run (`node harness.mjs <path to apps/api> <number of tests>`):

```js
// One server per "test", sequential supertest calls, close.
// Every server stamps its own id; a reply with another id reached the wrong server.
import http from 'node:http'
import { createRequire } from 'node:module'
const require = createRequire(process.argv[2] + '/package.json')
const supertest = require('supertest')
const N = Number(process.argv[3] ?? 2000)
let wrong = 0,
  resets = 0,
  ok = 0
for (let t = 0; t < N; t++) {
  const server = http.createServer((req, res) => {
    res.setHeader('x-server', String(t))
    res.end('{}')
  })
  // The fixed variant adds, here: await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  for (let r = 0; r < 3; r++) {
    try {
      const res = await supertest(server).post('/x').send({ a: 1 })
      if (res.headers['x-server'] !== String(t)) wrong++
      else ok++
    } catch (e) {
      if (e.code === 'ECONNRESET') resets++
    }
  }
  await new Promise((r) => server.close(() => r()))
}
console.log(`ok=${ok} wrong-server=${wrong} ECONNRESET=${resets}`)
```

A stranger's reply, as logged:

```
test 1260 call 1 port 60835: status 404 content-type text/plain;charset=utf-8 body not found
2.1.331 75595 tatiana 37u IPv4 TCP 127.0.0.1:60835 (LISTEN)
```

Ranked guesses before the harness, and how each ended:

1. Requests reach a program other than the test app — **confirmed** by the harness.
2. The one-connection pool drops or resets under load — not needed to explain any failure
   seen; the `ECONNRESET` also vanished with the fix in the harness.
3. A write not yet visible to the next request — ruled out: the misses were never the app
   answering.
4. A response that fails its schema check on random data — ruled out: the factories make no
   data that could break the handover schema.

## Diff-Review Findings

`code-review` on `git diff origin/staging...HEAD`, 2026-11-24, two fresh reviewers. The first
launch failed on a usage limit; the second ran on the branch at `b5c1b09`.

### Standards

No hard breach. Judgement calls, each with its answer:

1. **Test variable names** (`general.mdx`, Testing: `inputX`, `actualX`, `expectedX`). Fixed:
   `actualAddress`, `actualBindError`, `actualResponse`.
2. **Arrange, Act, Assert** (`general.mdx`, Testing; the test README, "Pattern AAA"). Fixed:
   the three blocks are apart and marked; every assertion sits at the end.
3. **The test README tree did not list the new spec.** Fixed: added beside
   `test-app.helper.ts`.
4. **The reason is written three times** (spec JSDoc, helper comment, guide). Fixed in part:
   the spec's comment is now one line that points to the guide. The helper comment stays: it
   guards a line that looks removable, which the reviewer agreed earns its place.
5. **The spec's Testing Strategy still blames the one-connection pool for `ECONNRESET`.** Not
   changed: the spec is the Architect's document. Passed on in the close report.
6. **Test name does not start with a verb.** Fixed: "binds the test app to 127.0.0.1, so no
   other program can answer for it".
7. **Smell, mild Mysterious Name: `intruder`.** Fixed: `competingServer`.

Commit `6fd46d9`. Format check, lint and typecheck are clean on the changed files. The
reworked test has **not been run yet**: see the blocker below.

### Spec

1. **reversal-of-reversal-refused is partial**: the regression test pins the port rule but
   never asserts a 409, and the real test already passed 25 of 25 before the fix. Answer:
   agreed on the facts. The stray answer comes about once in 4,500 calls on this machine, so
   no loop of one test can show the difference in reasonable time. The evidence that the fix
   works is the harness (4 stray answers and 2 resets in 18,000 calls before, 0 and 0 after)
   and the full runs: 4 of the 7 full runs before the fix had a stray failure (top-up 404,
   probe 404, participation with no `data`, wallet `ECONNRESET`), 4 of 4 after the fix were
   green. Ticked with this note; the Architect may judge it partial.
2. **failure-reproduced is met through its "or" branch**: the harness reproduces the cause,
   not the 500 on demand, and the work document says why. No change.
3. **Not asked for**: the 201 check (approved in the corrections), the guide paragraph, the
   wider Vitest include (needed for the new spec; no file runs twice). No change.
4. **Fragility**: a future caller that forgets `context.app` leaves a server listening. The
   guide says so; nothing enforces it. Answer: left as is. All 11 callers set it, and the
   teardown run showed 311 of 311 closed. A guard would mean a new hook in the e2e setup; not
   worth it for this task.
5. **System design not updated**: the spec says "no change planned before the cause is known",
   and its Seams name only the reversal route, while the fix changes the shared test setup at
   the `initializeTestApp` seam. Not changed: the spec is the Architect's. Passed on in the
   close report.

## Blockers and questions

**Docker does not answer — Mason, 2026-11-24 21:05.** After the review edits, the reworked
regression test hung before its first test: the global setup starts a Postgres container,
and `docker ps` and `docker info` gave no answer within 20 and 60 seconds. Restarting OrbStack
would stop other projects' containers, so I did not. Left to do once Docker answers: run the
reworked test, then `pnpm test`, then close. Resolved 2026-11-25: Docker answered again.
