---
name: retro
description: At the end of a workflow, evaluate the session and propose improvements to the WORKING RULES (not the code) — navigation, automated checks, coding standards, AGENTS.md hygiene, tool economy, no-ops, information access — sorted by severity. Invoked by the close step of `.agents/workflow.md`. Never auto-applies anything; the human or the touched zone's owner accepts each proposal.
x-upstream:
  repo: mattpocock/skills
  path: skills/in-progress/retro
  sha: 6654f6b60cd9d5be8b54c6fafe44346dabeb3b76
  changes: "adapted: sources are the session transcript AND those of its subagents first, then the repo artifacts that corroborate them (the task's spec document, and its work document with the program design, the checkboxes and the worklog, plus the diff and the journal entry) — reading is unrestricted, only the WRITING of conclusions is bound to the repo by discipline.md rule 8; calls writing-great-skills, which is this same upstream skill vendored under its former name; target files resolve via .agents/project.md instead of hardcoded paths; each proposal names its target file and zone owner; nothing is ever auto-applied, and a deferred proposal gets a dated line instead of being dropped; drops disable-model-invocation — this skill is invoked by the close step of the workflow, not only on user request; a blocker is read where the task's own documents keep it rather than in the project journal."
---

You are suggesting improvements to the **working rules** — the steering
files, standards, and docs an agent reads — never to the code itself. The
code's findings already went through `code-review`; this is about making the
*next* session faster or more correct.

## Sources

Rule 8 of `.agents/discipline.md` governs where conclusions are WRITTEN, not
what may be READ: reading the session back is the point of a retrospective;
what it produces goes in the repo, never in a harness memory.

**Primary — the session itself, and its subagents.** Where the friction
actually lives: dead ends, searches that came back empty, files that took
three tries to find, a rule that was read and not followed, an instruction
that changed nothing. None of it survives into the diff, which only records
what worked. Read the transcript of the session being closed AND the
transcripts or returned reports of every subagent it spawned. Access is
harness-specific — in Claude Code, the session's own `.jsonl` under
`~/.claude/projects/<project-slug>/` plus the task output files of its
subagents; other harnesses differ, and some expose nothing. When none is
reachable, say so in the retrospective and work from the artifacts alone: a
retro built on the diff sees the destination, not the road.

**Corroborating — what the session left in the repo.** Under version
control, so it says what was actually decided rather than what was
discussed:

- The task's **spec document** — its 🧑 decisions, and its Notes, written
  before a work document existed.
- Its **work document** — the program design, the implementation checkboxes,
  the worklog, Notes & Snippets and the review findings, including
  whatever was noted without stopping along the way.
- The diff and commit messages of the session (`git log`, `git diff`).
- The dated journal entry the work produced.
- Any blocker, and the ruling on it, where the task keeps it: an
  implementation blocker in the work document, one met before the plan in the
  spec document's Notes, each signed with its author's role plus the date and
  the time. The form and the destinations are in `.agents/workflow.md`
  ("Blockers and questions") — there is no journal line and no separate
  escalation item to go looking for.

## Steps

1. Call the Skill tool with `writing-great-skills` for the writing style
   guide — the same skill upstream now ships as `writing-for-agents`,
   vendored here under its former name.

2. Read the sources above for the session just closed: the transcripts
   first, the repo artifacts to confirm what they suggest.

3. Look for candidates for improvement in these categories, in order of
   severity:

- **Navigation**: how easy was it to find the right files? Are there hidden
  dependencies between files? Would a navigation pointer make it easier?
  _Use when_ the session took a long time to find a piece of information.
- **Automated checks**: are there checks that could catch errors the agent
  made? Linting, typing, tests, filesystem linters? _Use when_ a mistake
  could have been caught by an automated check.
- **Coding standards**: should the reviewer agents of `code-review` be given a new
  rule to enforce? Should an existing rule be removed or clarified? _Use
  when_ review failed to catch a mistake.
- **AGENTS.md hygiene**: are there steering instructions that should move to
  coding standards or an automated check instead? _Use when_ the rendered
  AGENTS.md block or `.agents/discipline.md` is getting large.
- **Tool economy**: did the session make expensive tool calls that could be
  streamlined? Any custom tooling that is particularly token-inefficient?
  _Use when_ an expensive tool call showed up.
- **No-ops**: instructions in the steering files that did not change the
  agent's behavior this session. _Use when_ the steering files are large and
  unwieldy.
- **Information access**: opportunities to increase access to information —
  tee'd logs, read-only access to a third-party service. _Use when_ a
  crucial piece of information was not available.

4. For each candidate, resolve its **target file** via `.agents/project.md`
   (the reading list of §C · Reading list, the living docs of
   §D · Documentation reference) rather than a hardcoded
   path — the same rule applies to a socle skill, a project doc, or
   `.agents/discipline.md` itself. Name the **zone owner** who accepts it:
   the human for anything ambient, the touched zone's owner for anything
   scoped to that zone.

5. Present the candidates to the human or zone owner, in severity order.
   **Nothing is auto-applied.** An accepted proposal is written in by its
   owner (or by the agent, once the owner has said yes) as a normal edit to
   the target file. A proposal that is deferred rather than accepted gets a
   dated line in the target file's Notes (or, absent one, in the project's
   changelog) instead of being silently dropped — so the next retrospective
   does not re-discover it from scratch.

## Reference

### Implementation vs review

All work goes through two stages: implementation and review. The
implementation session (the Mason writing its program design at the plan
step, then typing it) carries the most context pressure — exploration, writing
code, debugging failures. The review sub-agents carry the least —
it receives a diff, no exploration needed. This is why coding standards
belong with the reviewer, not the implementer: enforcement is cheapest where
context pressure is lowest.

### Files

- `AGENTS.md` / `CLAUDE.md`: pushed into every session's context. Use
  sparingly — mostly navigation pointers to other files.
- `.agents/discipline.md`: the ambient core, which the AGENTS block points a
  reader at. Same sparing rule.
- Coding standards: read during review, not implementation. Add navigation
  pointers to docs folders if a standards file grows past roughly 1,000
  lines.
- Living docs (declared in `.agents/project.md` §D): reference material other
  files point to. Look for an existing doc before proposing a new one.
- Skills: for know-how and user-invoked commands, per `writing-great-skills`.
