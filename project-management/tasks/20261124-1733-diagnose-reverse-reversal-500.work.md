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

## Implementation Checkboxes

- [x] Repeatable check that goes red (the harness: about 1 call in 4,500 answered by a
      stranger, on this machine)
- [x] Cause named, with evidence
- [ ] Regression test written and seen red
- [ ] Fix in `initializeTestApp`, regression test green
- [ ] Real test looped 25 times, full API suite run three times, logs read
- [ ] Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- [ ] API testing guide paragraph
- [ ] `code-review` on the diff since `origin/staging`, findings recorded
- [ ] Close: criteria ticked, documents archived, journal entry, `retro`

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
