# Workflow — one task, from intent to commit

This page is the whole workflow, in prose. It says the steps of a task, who
does each, where the work stops for a reading, and where the tracker is
read and updated. The rules that apply to every session are
`.agents/discipline.md`; the reasons behind this page are
`.agents/methodology.md`; the words it uses are defined in
`.agents/reference.md`.

**Chisel processes one task.** It takes a task from its intent to its
commit, and to its pull request when one is wanted. It writes or sharpens
the spec first when the intent is not yet clear. It does not orchestrate:
watching a tracker, scheduling tasks, deciding which task runs next belong
to the layer above — a human, a harness, a long-lived orchestrator thread,
or a script.

## The roles

| Role | Who plays it | What it does |
|---|---|---|
| **Architect** | The agent a human, or an orchestrator, talks to. This is its default role. | Reads the task, writes or sharpens the spec, launches a Mason and talks with it, reads and corrects the plan, rules on what the Mason reports, brings the key questions to the human. |
| **Mason** | A sub-agent launched by the Architect. | Writes the plan in the work document and stops for the Architect's reading. Then launches a Typist to code it, runs `code-review`, and closes the task. |
| **Typist** | A sub-agent launched by the Mason once the plan is approved. | Types code from the approved plan and decides nothing, at a cheaper tier than the Mason's (`.agents/reference.md`, "Model tiers"). |
| **Reviewers** | Sub-agents launched by the `code-review` skill. | Read the diff with no context from the session that wrote it. |

**The human** owns the intent and the decisions that shape the task. The
Architect approves the plan. A plan that departs from a decision the human
made goes back to the human, with the question stated.

The Architect's thread can be one long thread that compacts and serves as
the entry point to a project, or one thread per piece of work. In a long
thread the Architect can run several Masons, one per task or slice.

## The steps

**1. Read the task — Architect.** Read it where it lives, through the
skill or tool the tracker section of `.agents/project.md` names: an issue
in a tracker, a line in beads, a spec document in the task workspace, or
simply the message in the prompt.

**2. Write or sharpen the spec — Architect.** When the task arrives clear —
a well-written issue, a clear request — write the spec document from it,
with no interview: from the spec template declared in `.agents/project.md`,
named with the task id script, short, linking the issue rather than copying
it. When the intent is unclear, interview the human first with the
`grilling` skill, one question at a time, a recommended answer with each,
with `domain-modeling` underneath: new domain terms land in the glossary
and hard-to-reverse decisions in an ADR, where the glossary and decisions
section of `.agents/project.md` puts them. Either way the seams are named, and the sizing check is said out loud: the
task fits one pass, or it is cut into slices with the `slice-task` skill.
The human approves the spec when it carries decisions the task did not
state; otherwise the Architect moves it to `ready` itself. Commit the spec.
Status: `draft`, then `ready`.

**3. Plan — Mason.** The Architect launches a Mason with the brief
below. The Mason reads the spec document and what it links to, creates
the work document beside it from the work template, and persists its
program design there: files, seam signatures, test order, the decisions the
spec left to the implementation. Then it stops and reports. No code before
the plan is approved. Status: `in-progress`, written by the Architect at
launch.

**4. Read the plan — Architect.** Read the spec and the work document,
nothing else. Correct the plan with the Mason, then approve it: the
approval is written on the work document's `**Plan:**` line, with who and
when. A plan that departs from a decision the human made goes to the human
first.

**5. Code — a Typist the Mason launches.** Once the plan is approved,
the Mason launches a Typist with the brief below. The Mason types
itself only a retouch of a few lines, or while the plan is not settled, and
writes which exception applies and why in the work document's worklog. The
Typist executes the approved plan in vertical steps, test-first at the
agreed seams (the `tdd` skill). Tick
the work document's checkboxes as work lands — they are the resume point —
and commit at each green step. Run the gate commands declared in
`.agents/project.md`. Reality that contradicts the plan is fixed in the
plan, in writing; reality that contradicts the spec is reported.

**6. Review — Mason.** Run the `code-review` skill on the full diff of
the task. Its reviewers are fresh sub-agents that never saw the session
that wrote the code — never skip this step, even for a small retouch. Write
the findings in the work document; fix each one or answer it there.

**7. Close — Mason.** Tick the spec's acceptance criteria against
reality. Promote evergreen material into the living docs declared in
`.agents/project.md`, the glossary and the ADRs among them. Archive the spec and work documents together. Add the
dated journal entry. Run the `retro` skill and put its proposals in the
report. Stop everything you started — Docker containers, dev servers,
background processes — each by its own identifier (container name or id,
PID), and only those: never by pattern (`pkill -f`, `--all`), which stops
the work of others. Commit, update the tracker, and report to the
Architect: what landed, which criteria are met, what is left. Status:
`done`.

**After the close — Architect.** Read the close report and rule on anything
left. Open the pull request. Merge and publish as the merge and publish
section of `.agents/project.md` says; by default, ask the human, whose
explicit word on that very action is the only go.

## Where the work stops

| Who stops | For whom | When |
|---|---|---|
| Mason | Architect | After the plan; after the close, with its report; on a blocker it cannot rule on |
| Typist | Mason | After its part of the plan; on anything the plan does not answer |
| Architect | Human | On an unclear intent; on a spec that carries decisions the task did not state; on a plan that departs from the human's decisions; on a blocker above what it owns |
| Architect | Human | Before a merge or a publish, unless the project lets the agent do it |

Everything else runs without a stop. A question that is not one of these is
the Architect's to settle.

## The tracker

The tracker section of `.agents/project.md` says where tasks live and which
skill or tool reads and updates them. Whatever the tracker, the spec and
work documents live in the task workspace, and the tracker item points at
the spec document. The tracker is read at step 1 and updated at each status
change, by the thread doing the step.

## Statuses

A task has one status. The thread doing a step writes the status it leaves.

| Status | Meaning | Left by |
|---|---|---|
| `draft` | The spec is being written, or waits for the human's approval | step 2 |
| `ready` | The spec is approved and nothing holds the task | step 2 |
| `in-progress` | A Mason is planning, coding, reviewing or closing it | step 3 |
| `done` | Criteria ticked, documents archived | step 7 |
| `blocked` | Held by a named dependency, written after the value | whoever meets the block |
| `deferred` | Postponed on purpose | the human |
| `cancelled` | No longer wanted | the human |

Plan approval is not a status: it is the work document's `**Plan:**` line.
In a task file the value is written alone on the `**Status:**` line, free
text after it if it helps. A tracker maps the seven onto its own states, in
the skill that reads it.

## Sub-agents

Launch one only for a context that must stay clean, for work that runs in
parallel, or for a cheaper model. Each one costs tokens and a brief to
write. Three earn it:

- **The Mason** keeps the Architect's context clean for reading the plan
  and ruling on reports.
- **The Typist** types the approved plan on a cheaper tier than the
  Mason's.
- **The reviewers** bring fresh eyes to the diff.

A brief is artifacts and paths, never the conversation: whatever the
sub-agent needs must already be in the repo. Reviewers are always fresh. A
Mason is reused within a live thread — the one that wrote the plan
launches its Typist and runs the review — and a resumed task starts fresh
from the spec and work documents.

## The Mason brief

What the Architect writes when it launches a Mason:

- the spec document's path, and the work template's;
- the branch to work on, and how to commit (explicit paths, no push);
- the gate commands;
- the steps it owns: plan, then stop for the reading; code, through a
  Typist; `code-review`; close;
- what it reports at each stop: the plan in a few lines and its questions;
  at the close, the commits, the criteria met or not, and what is left.

## The Typist brief

What the Mason writes when it launches a Typist:

- the approved work document's path, and the part of the plan to type;
- its tier: *cheap* when the plan is mechanical, *mid* otherwise
  (`.agents/reference.md`, "Model tiers", which also resolves the model);
- the branch, the gate commands, the commit rule;
- type the plan and decide nothing: anything the plan does not answer is
  reported, not guessed;
- tick a box only for what really ran, on the real target; a dry run, or
  a run on a copy or a test base, is written in the worklog and leaves
  its box open.

## Blockers and questions

A role that cannot decide reports to whoever launched it. Blocked twice on
the same thing, or pushed outside the approved plan: stop and report. The
block leaves a written trace in the task's own documents — the work
document once it exists, the spec document's Notes before — signed with the
role, the date and the time. The ruling is recorded in the same place,
signed the same way. A ruling given out loud is written down too.

A report is answered, always: rule on it now, defer it on purpose ("noted,
later"), or hand it one rung up. A refactor met while coding is reported
with its size, its risk, and whether the task can be delivered cleanly
without it; the work goes on while the report travels.

When the Architect brings a question to the human:

- **One report, at the end of the turn.** No narration between steps.
- **Fact, problem, options.** Say what is true, what is wrong with it, and
  the ways out, one per line, with a recommendation. One hard question per
  report when the answer changes what happens next.
- **Each report stands on its own.** Never point back at "question 1" or
  "the point above"; restate an open question in place.
- **Never repeat what is settled**, and never ask again for an approval
  already given.
