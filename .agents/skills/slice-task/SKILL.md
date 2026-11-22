---
name: slice-task
description: Break a task, plan, or the current conversation into a set of tracer-bullet slice files, each declaring its blocking edges, published to the task folder. Use when a task is too large for one pass and the user wants it sliced.
disable-model-invocation: true
x-upstream:
  repo: mattpocock/skills
  path: skills/engineering/to-tickets
  sha: 2ab958093e83e0ec752e6c1c5932da465bf23e0c
  changes: "adapted: publishes slices into the task folder; 'ticket' reserved for external trackers; project paths resolve via .agents/project.md; each slice is published as one <NN>-<slug>.spec.md spec document whose emitted template carries no program design and no agent zone — the implementing session creates the matching .work.md at its plan step"
---

# Slice Task

Break a plan, task, or conversation into **slices** — tracer-bullet vertical
slices, each declaring the slices that **block** it.

Slices are published in the task workspace declared in §A · Task workspace of
`.agents/project.md`. When §B · Tracker of the same file names another tool,
each slice also gets an item there that points at its spec document.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a
reference (a task file path) as an argument, read it fully.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current
state of the code. Slice titles and descriptions should use the project's
domain vocabulary.

Look for opportunities to prefactor the code to make the implementation easier.
"Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** slices.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API,
  UI, tests) — vertical, NOT a horizontal slice of one layer
- Any prefactoring should be done first

</vertical-slice-rules>

A slice's shape — demoable on its own, sized for a single fresh context
window — is defined once, in the Glossary of `.agents/reference.md`.

Give each slice its **blocking edges** — the other slices that must complete
before it can start. A slice with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor**
is one mechanical change — rename a column, retype a shared symbol — whose
**blast radius** fans across the whole codebase, so a single edit breaks
thousands of call sites at once and no vertical slice can land green. Don't
force it into a tracer bullet; sequence it as **expand–contract**. First
expand: add the new form beside the old so nothing breaks. Then migrate the
call sites over in batches sized by blast radius (per package, per directory),
each batch its own slice blocked by the expand, keeping CI green batch to
batch because the old form still exists. Finally contract: delete the old form
once no caller remains, in a slice blocked by every migrate batch.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Blocked by**: which other slices (if any) must complete first
- **What it delivers**: the end-to-end behaviour this slice makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct — does each slice only depend on slices that
  genuinely gate it?
- Should any slices be merged or split further?

Iterate until the user approves the breakdown.

### 5. Publish the slices

Write one spec document per slice under the task workspace declared in
`.agents/project.md` (default
`/project-management/tasks/<time-id>-<feature-slug>/<NN>-<slug>.spec.md`),
where `<time-id>` comes from `scripts/task-id.sh` and `<NN>` numbers the
slices from `01` in dependency order (blockers first). The parent spec
document (if one exists) stays in place and links to the slice folder.

No work document is created here. The Mason that implements a slice creates
the matching `<NN>-<slug>.work.md` beside it at its `plan` step, from the work
template declared in §A · Task workspace of `.agents/project.md`.

Work the **frontier**: any slice whose blockers are all done. For a purely
linear chain that means top to bottom.

<slice-template>

# <NN> — <Slice title>

**Status:** draft
**Blocked by:** <numbers/titles of the slices that gate this one, or "None — can start immediately">

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

**What to build:** the end-to-end behaviour this slice makes work, from the
user's perspective — not a layer-by-layer implementation list.

## Acceptance criteria

- [ ] **descriptive-name** (machine-verifiable)
- [ ] **suite-green** — all tests pass

---

> 🧑 **REVIEW IF RELEVANT** — notes written before the work document exists.

## Notes

_A question or a blocker met before the plan — only what is written into
this document before its work document exists. Not the Mason's working
space: its notes, snippets and worklog live in the work document._

</slice-template>

At **slicing time**, avoid specific file paths or code snippets in "What to
build" and the criteria — they go stale fast. Exception: if a prototype
produced a snippet that encodes a decision more precisely than prose can
(state machine, reducer, schema, type shape), inline it and note briefly that
it came from a prototype. Trim to the decision-rich parts.

The program design is different, and it does not live in this document at
all: it is written at PLAN time by the implementing session, right before the
code, and persisted into the matching `.work.md` — target shapes, signatures
and illustrative snippets are welcome there because they are hours old, not
weeks. That file also carries the worklog and the implementation checkboxes.
