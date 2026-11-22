# Task Spec Template & Standards

## Context

**The form of this file.** Acceptance criteria, seams and decisions are named
by what they say, never by a code; a code that genuinely must be cited carries
its meaning in parentheses. A reference names its file and its section title —
never a line number, which is wrong by the next edit — and says in one
sentence what the reader finds there. Each 🧑 zone is understood without
opening another file: a link that offers depth is welcome, a link the sentence
cannot be read without is not. The rule is the writing rule of
`.agents/discipline.md`.

The spec document is the human review surface, the requirement against which a
diff is judged, and the archive record of what was asked. It contains no
program design, pseudo-code, worklog or implementation checkboxes: these are
in the work document, created at the plan step by the Mason.

A spec written from a clear task stays short and links the task rather than
copying it. A spec with no work document beside it has never been planned.

## The two zones

| Zone | Who reads it | What belongs there |
|---|---|---|
| 🧑 **REVIEW CAREFULLY** | The zone's owner, before any code | Context, Scope, named Acceptance Criteria, Seams, Architecture / system design |
| 🧑 **REVIEW IF RELEVANT** | The zone's owner, for medium/large tasks | Implementation Decisions, Testing Strategy, Slices & Dependencies, Deliverables, References, Notes, Retrospective |

- The 🧑 REVIEW CAREFULLY zone must fit in working memory. Prefer a diagram or
  mockup over three paragraphs.
- Who owns a zone is the rule of "Zone ownership" in
  [reference.md](/.agents/reference.md): whoever approved it.
- The 🧑 zones carry their owner's decisions. Surface a conflict; never
  silently contradict one.
- There is no agent zone here. The Mason's working space is the work
  document, a different file.

## The two documents

| Spec document | Work document |
|---|---|
| Context · Scope · Acceptance Criteria · Seams | Program design and its approval line |
| Architecture / system design | Worklog |
| Implementation Decisions | Implementation checkboxes |
| Testing Strategy · Slices & Dependencies | Notes & Snippets |
| Deliverables · References | Review findings from `code-review` |
| Notes (written before the plan) · Retrospective | |

Before a work document exists, a blocker or a question goes into this
file's **Notes**. Once the plan starts, notes go into the work document's
**Notes & Snippets**, never here.

One work document exists for every spec actually planned, created beside
this file by replacing `.spec.md` with `.work.md`. A parent spec of a sliced
task has none; each slice has its own. At the close, both files are archived
together.

## Where each kind of content lives

| Content | One task | Parent + slices |
|---|---|---|
| Why / what / success criteria / seams | this spec | parent spec |
| Architecture | this spec | parent spec |
| Program design | work document | each slice's work document |
| Slice list + blockers | — | parent spec |
| Worklog, checkboxes, Notes & Snippets | work document | each slice's work document |
| Status | this spec, or the tracker | each slice's spec, or the tracker |
| Archive | spec + work together | parent + slice folder together |

## Spec Document Template

All spec documents MUST follow this structure:

```markdown
# <Task name>

**Status:** draft

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

<Why this task exists.>

## Scope

**Included:**
- <specific deliverable>

**Not Included:**
- <boundary>

## Acceptance Criteria

Every criterion has a short descriptive **name** (for example
`no-orphan-file`), never a bare ordinal label. Every criterion is
machine-verifiable. An amended criterion is struck and its dated replacement
is added below it.

- [ ] **descriptive-name** (testable/verifiable)
- [ ] **suite-green** — all tests pass

## Seams

- Seam 1: <public boundary> — <observable behavior>

## Architecture

**System design:** <how pieces relate>. The indicative files-to-modify /
files-to-avoid map belongs to this design and is written once per slice in
"Slices & Dependencies".

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

Cross-cutting rulings and constraints. Never put the program design here: it
belongs wholly to the work document.

## Testing Strategy

- <seam behavior to test>

## Slices & Dependencies

- **Slices:** 1. <slice> (blocked by: none)

## Deliverables

- [ ] <output>

## References

- <document and section, saying what the reader finds there>

## Notes

Only material written into this file before a work document exists. The
Mason's notes, snippets and worklog belong in the work document's
**Notes & Snippets**.

## Retrospective

Added at the close: lessons and proposals. The human rules on its proposals.
```

## File Naming Conventions

Name a spec `<YYYYMMDD-HHmm>-<intention>.spec.md`, using
`scripts/task-id.sh <intention>` for the prefix. Place it in the task
workspace declared in `.agents/project.md`. Its work document has the same
name with `.spec.md` replaced by `.work.md`. For slices use
`<NN>-<slice-slug>.spec.md`; each gains a work document at its plan step.

## Statuses

A task has ONE status, one of the seven values of "Statuses" in
[workflow.md](/.agents/workflow.md): `draft`, `ready`, `in-progress`,
`done`, `blocked`, `deferred`, `cancelled`. In a task file it is written on
the `**Status:**` line:

- **The value is written alone**: `**Status:** blocked`, no emoji before it,
  free text (a date, a dependency, a reason) after it if it helps.
- **The thread doing a step writes the status it leaves.**
- **When a tracker holds the status**, the line says so —
  `**Status:** tracked as <id>` — and the status lives in the tracker only.

## When Creating New Tasks

1. Interview first when the intent is unclear; write from the task when it is clear.
2. Name the seams before writing.
3. Fill both 🧑 zones carefully.
4. Keep the top short; order detail rather than deleting it.
5. At the close, tick acceptance criteria against reality.
6. The Mason creates the work document at the plan step, never before.

## When Reviewing Tasks (human)

- Read REVIEW CAREFULLY before code and REVIEW IF RELEVANT for medium/large work.
- This document is the whole review surface.
- Check named, machine-verifiable criteria and seams.
- A work document is evidence at review, never the requirement.
