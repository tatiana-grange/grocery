---
name: codebase-audit
description: Audit a whole repo — blind finders one per lens, every claim reproduced, findings triaged against what was already decided, one report in the repo, then the human's decisions block by block.
disable-model-invocation: true
---

# Codebase audit

A whole-repo audit, end to end. Several **finders** read the material
**blind**, one per **lens** — a lens being one class of problem to hunt, one
line of text, and one finder's whole brief. Every **claim** a finder makes is
reproduced before it is asserted. The findings are **triaged** against the
audits and decisions that came before. One report lands in the repo, split
into **blocks** by subject, and the human decides block by block.

The audit ends on an action plan and repairs none of it. Each piece of that
plan becomes a task through this repo's normal path — interview, then a spec
document — where it gets the scoping and the review any other change gets.

Its diff-scale sibling is `.agents/skills/code-review/SKILL.md`, which judges
one change against this repo's documented standards and against the spec
document that asked for it. Reach for that one when the subject is a diff;
reach for this one when the subject is the material itself.

## 1 · Frame

Three lists, written down before any finder starts.

- **The scope.** What is audited — a repo, a socle, a subsystem — named by the
  human and resolved to actual paths.
- **The lenses.** "The default lens set" at the foot of this page is the
  starting recommendation: read it now, then put it to the human as a single
  decision with your recommended trim or extension inside it. A lens that
  cannot bite on this material earns its removal, and a risk this material
  carries that no lens covers earns a new lens, described in one line like the
  others.
- **The prior records.** The earlier audits, their decisions records — the
  kind of record step 6 of this skill writes — and the architecture decision
  records: together, what this audit's triage reads against. Find them through
  §A · Task workspace of `.agents/project.md`, which declares the task
  workspace, its archive and the journal, and §G · Glossary & decisions of the
  same file, which declares the glossary and where architecture decision
  records live. Then ask the human what else exists: a record kept outside the
  repo's own tree is common, and invisible to a walk.

Criterion: scope paths, the agreed lens list and the prior-record list are all
three written down as lists of names, and the human has seen all three.

## 2 · Finders, blind, one per lens

One sub-agent per lens, all spawned in a single turn so they read in parallel,
each at the **frontier** tier — which model that is resolves through "Model
tiers" of `.agents/reference.md`, the one place the cascade from a dev's own
file down to the socle default is written.

**Blind is the mechanism, not a precaution.** A finder receives its lens and
the material, and that is all it receives: not the other lenses, not the prior
records, not what the last audit concluded. A finder told what it is supposed
to find will find that. Two blind finders landing on the same thing from
different lenses is evidence; two briefed finders agreeing is an echo.

Brief each finder with its lens in the lens set's own words, the scope paths,
and the shape of a finding:

- the **claim**, one sentence, stated as a fact about the material;
- where it lives, cited by file path and section title, or by the quoted line;
- the severity as that finder sees it;
- how a reader would verify it — the command to run, the two files to diff,
  the line to open.

One finding per line of argument: a finding that bundles three arguments can
be neither reproduced nor decided.

Criterion: each finder returns the list of files it read, and for each lens
every in-scope file that lens applies to appears on that list — the list
itself, not a count and not a summary of it.

## 3 · Verify

Reproduce yourself every claim that would change a decision or that accuses
the code of a behaviour. Run the command and keep what it printed. Diff the
two files. Open the file the pointer names. A claim you reproduced is asserted
as fact, with its reproduction attached.

A claim that will not reproduce travels as **unverified**, in that word, with
what you tried — a state a reader can see, never a hedge folded into the
sentence.

Convergence is evidence of where to look, not proof: two finders can share one
wrong reading of the same sentence, so each one's claim is reproduced on its
own.

Criterion: every claim that would change a decision or accuses the code of a
behaviour carries either its reproduction — the command and its output, the
diff, the quoted line — or the word unverified.

## 4 · Triage against what came before

Read each finding against the prior records from step 1 and give it one of
three classes.

- **new** — nothing before this audit had seen it.
- **a fix that did not take** — an earlier decision meant to remove it and it
  is still there. Name that decision by what it decided, and say what of it
  remains undone.
- **already ruled** — the human decided otherwise, knowingly. It is listed
  once for the record and left there. Re-arguing a settled question is how an
  audit spends the human's trust in the whole report.

Findings that several lenses reached merge into one, keeping the strongest
reproduction and naming every lens that saw it, so the convergence from step 2
survives the merge.

Criterion: every finding carries exactly one of the three classes, and every
fix that did not take names the earlier decision it failed.

## 5 · Report

One file in the repo. The repo is the only memory an audit has: a chat
transcript, an artifact or a summary in a reply is gone the moment the session
is. It lands in the task workspace root declared in §A · Task workspace of
`.agents/project.md`, named `<YYYYMMDD>-audit-<scope>.md`.

Blocks by subject, so the human can settle one subject at a time in step 6.
Each block and each finding is named by what it says — "the five pointers to a
section that was renamed", not a letter and a number. Where a code helps
cross-reference, it rides beside the name at every mention: the reader of a
report arrives at any line, and a code travelling alone is a code nobody can
place weeks later.

Each finding carries its citation — file path and section title, or a quoted
line, never a line number, which is wrong by the next edit — plus its class
from step 4 and its verification state from step 3.

Criterion: the file exists, every triaged finding of step 4 is in it, and none
of them is in it without a citation.

## 6 · Decisions, block by block

Interview the human under the discipline of
`.agents/skills/grilling/SKILL.md`, where that discipline is written in full —
read it and run it, rather than reconstructing it from here. Two of its rules
carry this step: every question arrives with your recommended answer inside
it, and a fact is looked up instead of asked. What is put to the human is the
decision, and the decision is theirs.

Keep their own words, in the language they used, quoted.

Write each decision into a record beside the report as it lands, named
`<YYYYMMDD>-audit-<scope>-decisions.md`. Writing as you go is what makes the
record match what was said; a record written at the end is written from
memory. Each decision is named by what it decided and carries a plain-word
state: to decide, decided, or deferred. A deferral is dated and says what
would unblock it.

The record ends with the **action plan**: the ordered list of workstreams the
decisions form, each named by what it will do. Each becomes a task through the
normal path — interview, then a spec document.

Criterion: every block of the report has a decision or a dated deferral, and
the record ends with the action plan. The audit stops at that plan; carrying
any of it out is later work, under its own task.

## The default lens set

Six lenses, one line each for what its finder hunts. The human trims the set
or extends it at step 1, and the finder briefs at step 2 are built from
whatever the set became.

- **joints** — every pointer resolves: a path, a section title, a name that
  has to exist somewhere.
- **contradictions** — one subject settled two ways in two places.
- **over-claims** — a document claims a behaviour the code or its tests do not
  have.
- **sediment** — layers left behind by past changes: a dead option, a stale
  label, an orphan file, a template still quoting its own history.
- **behaviour** — the code against its tests and its stated contract: bugs,
  untested paths, a test that passes whatever the code does.
- **cold reader** — what a reader arriving weeks later cannot place: jargon,
  an invented label, a code travelling alone.
