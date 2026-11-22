# Methodology — the why behind the workflow

This document explains the reasoning behind the workflow so that humans and
agents apply it with judgement, not cargo-cult. The **steps** are
`.agents/workflow.md`; the **vocabulary, zone ownership and model tiers** are
`.agents/reference.md`; the **ambient rules** are `.agents/discipline.md`;
the **shape of the documents** is the spec and work templates declared in
§A · Task workspace of `.agents/project.md`. This file is the **why**.

Provenance: fusion of the Lonestone task lifecycle (creation → work →
completion, a dated journal) with patterns from
[mattpocock/skills](https://github.com/mattpocock/skills) (MIT) and dex's
"Why Software Factories Fail" series.

## Why one task, and why prose

Current frontier models are good enough that heavy guidance costs more than
it returns. A version of chisel that chained steps with sub-agents, piloting
modes, role contracts and a long status ladder cost more to run than the first
version, written in prose, and the extra context engineering did not pay.
So the workflow is one page of prose, and chisel processes one task:
chaining tasks belongs to the layer above.

The roles are the fewest that hold the quality. The Architect reads the plan
and settles what it can, so only the key questions reach the human. A
sub-agent is launched only for a context that must stay clean, for parallel
work, or for a cheaper model. The code review is the one place where a
change of context is essential: reviewers that never saw the session that
wrote the code. It is also the step a light process must not skip.

## Why a reading gradient (and not shorter files)

Models cannot be trusted to maintain codebase quality over time without
human steering, so the human must review — and review is only cheap when the
human knows **what** to read and **how carefully**. The spec document is the
decision surface, read according to its two 🧑 zones before any code; the
work document is working space, read for implementation context and review
evidence.

We don't cut detail, we order the spec document by review criticality. Only
its top decision surface must stay short — prefer a mockup or diagram over
three paragraphs. Every decision NOT made explicit in a 🧑 zone is a decision
the human would otherwise make implicitly during code review — the most
expensive possible moment to change one's mind.

## Why seams are named before implementation

A seam is a system-design boundary named in the spec. Naming seams up front
means testing effort lands on critical paths instead of every edge case, and
the tests survive refactors because they observe public behaviour, not
internals. It is also the cheapest moment to catch a bad boundary — before
code exists on both sides of it.

## Why the spec is written only as far as the intent needs

A task that arrives clear needs no interview: the Architect writes the spec
from it, short, linking the issue. Writing a spec before shared
understanding produces confident nonsense, so when the intent is unclear the
`grilling` skill interviews one question at a time, with a recommended
answer per question — facts are looked up, decisions are put to the human.
The human approves a spec when it carries decisions the task did not state;
asking for approval of what the human already wrote is load for nothing.

## Why slicing is conditional (the sizing check)

The sizing check runs for EVERY task; slice documents are only created when
the answer demands them.

- A slice is defined as "fits in a single fresh context window, demoable in
  one pass". A small task already satisfies both — slicing it would produce a
  folder with one slice that duplicates the spec document.
- What slicing adds is **decomposition**: blocking edges, the frontier, the
  order. That only has value when there are several pieces.
- Real-world distribution (dex): ~40% of work is one-shot, medium work gets a
  single spec/work pair, only large work gets the full breakdown.

What IS unconditional: the check itself, stated out loud — "this fits in one
pass" or "this needs slicing, here is the breakdown". And **vertical-slice
discipline during implementation** (never layer by layer, something demoable
at each step) applies to ALL work, sliced or not.

## The two designs — and why they do not happen at the same moment

**System design** — how the pieces talk: services, contracts, schemas, data
models — is in the spec document's Architecture section, 🧑 REVIEW
CAREFULLY. It is settled when the spec is written. A task is ready to be
produced when its system design is settled, not before; what makes it ready
is that the expensive-to-reverse decisions are made, not that it is small.

**Program design** — the target shape inside the agreed architecture: files,
seam signatures, test order — is deliberately NOT written with the spec.
Designing slice 6's files before slices 1–3 have taught anything produces
stale guesses. The Mason writes it at the plan step, with the real code
in view, and **persists it in the work document** before any code; the
Architect reads and approves it there. Three reasons to persist it:

1. **The review reads the pair.** `code-review`'s Spec axis treats the whole
   spec document as requirements and the work document as evidence; a
   design that lives only in chat is invisible to it.
2. **Dependent slices read the artifacts.** Slice 04 can build on decisions
   made in slice 01's work document; the committed pair is the channel
   between fresh contexts.
3. **Re-runs and crashes.** A session must be resumable from the spec and
   work documents alone.

The delegation boundary is the **system design**: above it the *what* —
architecture, scope, seams — settled in the spec; below it the *how*,
designed and typed by the session that implements. A Mason asked to
"figure out" something the *what* left open is a specification failure, and
it goes back to the spec. An open *how* is not a hole: it is what the plan
step is for.

Once the plan is approved it is a complete brief, which is what makes a
Typist possible: a cheaper model types a settled plan, and the frontier
tier is kept for judgement — the spec, the plan, the review. So the
Mason hands the typing to a Typist by default. A Mason that types its
own plan pays the frontier price for typing: on 2026-11-03 one of chisel's
own tasks ran 383 calls, all at the frontier tier, none of them a Typist's.
The brief is **artifacts
only, never the conversation**: explicit references beat shared memory, and
a plan that could not be implemented from the artifacts is a finding
against the spec — fix the file, not the session's context.

## Why the review runs on two axes, in fresh sub-agents

A change can follow every standard and implement the wrong thing, or do
exactly what the task asked while breaking conventions. The `code-review`
skill runs **Standards** (documented repo standards plus a fixed baseline of
Fowler smells, always judgement calls) and **Spec** (the whole spec
document, system design included, as requirements; the work document as
evidence) as separate axes so one cannot mask the other. Each axis is a
fresh sub-agent: a reviewer that wrote the code, or watched it written,
reads its own intent into it.

## Why seven statuses

A task carries one status from one short list. Seven values are what a task
needs for itself: being written, ready, in progress, done, and three ways
off the path (blocked, deferred, cancelled). Anything finer — who is waited
on, which step a task is at — belongs to the tracker or is read from the
documents: the plan's approval line, the ticked checkboxes, the worklog.
The thread doing a step writes the status it leaves, so the value is never
older than the work. A tracker maps the seven onto its own states, in one
place: the skill that reads it.

## Why the time-id prefix

`scripts/task-id.sh` generates `YYYYMMDD-HHmm`. Prefixing spec documents and
slice folders with it gives automatic chronological sorting while the rest of
the name carries the intention. Incremental numbers are banned: they collide
across branches and carry no meaning.

## Why the journal stays

The journal declared in `.agents/project.md` §A is the project's narrative
memory: agents grep it and read the recent entries to load context cheaply at
session start. It is **written by hand** — one dated entry per task, added at
the close — and **never generated**: not from a tracker's audit trail, not
from the git history. Narration nobody wrote is worth nothing to the next
reader.

It complements — never replaces — the task archive (structured detail), the
living docs (current state), and the domain memory kept by the
`domain-modeling` skill: `CONTEXT.md` (the glossary) and `docs/adr/`
(decisions that are hard to reverse, surprising without context, AND real
trade-offs — all three or no ADR).

## Artifact ladder (plans → evergreen)

Program-design diagrams and working material start in work documents;
system-design and architecture diagrams stay in the spec document. At the
close, the material a future reader needs is **promoted** into the living
docs declared in `.agents/project.md` (default `doc/**`), never inside the
task workspace — which is narrative and planning, not the living
architecture. Prefer `doc/architecture/` for as-built seams and integration
diagrams; add `doc/domain/` when the glossary needs a home.

**Keep temporary rewrite labels out of the promoted pages.** A label such as
"v2" or "the new pipeline" means nothing to a reader who arrives after the
migration has ended. An evergreen page says what the system does; the label
stays with the task documents that carried the migration.
