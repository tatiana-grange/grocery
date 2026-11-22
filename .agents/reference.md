# Reference — vocabulary, zone ownership, model tiers

The words this workflow uses, the rule that says who owns a review zone, and
the model tiers with the order in which they resolve. Each is written here
once and pointed at from everywhere else. The steps are
`.agents/workflow.md`; the reasons are `.agents/methodology.md`; the rules
for every session are `.agents/discipline.md`.

## Glossary

| Term | Meaning |
|---|---|
| **Task** | The unit of work. Its spec document lives in the task workspace declared in `.agents/project.md` (default `/project-management/tasks/`), named `<time-id>-<intention>.spec.md`, whatever tracker also carries it; once planned it has a matching `<time-id>-<intention>.work.md` beside it. |
| **Spec document** | The review surface and the requirement: intent, acceptance criteria, seams, system design, decisions, testing strategy, slices, deliverables, references, pre-plan Notes and retrospective. It carries the task's status line and the reading gradient's two 🧑 zones. |
| **Work document** | The Mason's companion file, created at the plan step beside the spec document. It carries the program design and its approval line, the worklog, the implementation checkboxes, Notes & Snippets and the review findings. No zone marker. |
| **Slice** | A child task produced by cutting a large task: a tracer-bullet vertical cut through every layer, demoable on its own, sized for one fresh context window. Lives as `tasks/<time-id>-<feature>/<NN>-<slug>.spec.md`. A small task IS its own single slice. |
| **Seam** | The public boundary where a feature is tested — named in the spec BEFORE implementation. Tests live at seams, never against internals. Fewer is better (ideal: one). |
| **Reading gradient** | The ordering of the spec document by review criticality: 🧑 REVIEW CAREFULLY (short, decision-rich) → 🧑 REVIEW IF RELEVANT. Detail is never cut, it is ordered. |
| **Blocking edge** | A dependency between slices: "slice 3 is blocked by slice 1". A slice with no blockers can start immediately. |
| **Status** | The task's single state, one of the seven values of "Statuses" in `.agents/workflow.md`. |
| **Frontier** | The set of slices whose blockers are all done — what can be worked on right now; a task on it has the status `ready`. |
| **Expand–contract** | The sequencing for wide mechanical refactors (rename a column, retype a shared symbol): add the new form beside the old → migrate call sites in batches → delete the old form. The exception to vertical slicing. |
| **One-shot** | Work done without a task artifact. The discipline still applies; only the file bookkeeping is skipped. |

The roles — Architect, Mason, Typist, reviewers — are defined in "The
roles" of `.agents/workflow.md`.

We do NOT use the word "ticket" for local work. It is reserved for items in an
external tracker, named in the tracker section of `.agents/project.md`, and
for the decision tickets of a wayfinder map
(`.agents/skills/wayfinder/SKILL.md` charts a foggy effort as a map of
decision tickets and resolves them one at a time).

## Zone ownership

A 🧑 zone belongs to whoever **approved** it. The human approves a spec that
carries decisions the task did not state; the Architect approves one written
from a clear task, and then the zones carry the task's own decisions, which
are the human's. The work document has no zone: it belongs to the Mason
that wrote it. A 🧑 zone is never overridden silently — a conflict with one
is surfaced, never edited sideways.

## Model tiers

The socle names no model: what a role declares is a **tier**, a property of
the work — how much judgement it needs.

| Tier | What it is for | Roles |
|---|---|---|
| **frontier** | Thinking and reviewing — where a wrong judgement is expensive and caught late | Architect, Mason, reviewers |
| **mid** | Ordinary work that needs competence but not judgement | The Typist, by default |
| **cheap** | Typing a mechanical plan: every change named down to its file and place, nothing left to choose | The Typist, when the plan is mechanical |

(Not to be confused with **Frontier** in the glossary — a position in the
dependency graph, not a model tier.)

Which concrete model a tier means resolves in this order; the first level
that answers for a tier wins it:

1. **`.agents/user.md`** — the dev's personal file, never committed, posed
   from `.agents/user.md.tpl`.
2. **`.agents/project.md`, §H · Model tiers** — the team's mapping, if it
   agreed on one.
3. **The socle default**: *frontier* is the strongest reasoning model your
   tool offers, *mid* its standard everyday model, *cheap* its fastest and
   least expensive one.

A dev with no `user.md` is never blocked: resolution falls through to the
next level, which every tool can satisfy. Nothing may require that file.
