# Task Work Document Template & Standards

## Context

**The form of this file.** Program-design decisions, worklog entries and
findings are named by what they say, never by a code; a code that genuinely
must be cited carries its meaning in parentheses. A reference names its file
and its section title — never a line number, which is wrong by the next edit
— and says in one sentence what the reader finds there. The rule is the
writing rule of `.agents/discipline.md`.

The work document is the Mason's own file: its program design and the
line that records its approval, its worklog, its implementation checkboxes,
its Notes & Snippets, and the findings of the review. No zone marker: the
reading gradient does not apply to working material. The reasoning behind
the split is "The two designs — and why they do not happen at the same
moment" of [methodology.md](/.agents/methodology.md).

**Who creates it, when, where, under what name.** The Mason creates it at
the plan step, never earlier. It lives beside its spec, named by replacing
the spec's `.spec.md` suffix with `.work.md`: same time id (or slice
number), same directory. A spec with no work document beside it has never
been planned.

**Lifecycle.** While work is live, the work document can be deleted and
regenerated. At the close it is archived **alongside its spec**, both files
moved together: the review read the program design as evidence, a
retrospective may cite the worklog, and the repo is the only memory this
system has. A parent spec of a sliced task never gets a work document of its
own — only its slices do.

**The Architect reads it and approves the plan.** It corrects the plan with
the Mason, then the approval goes on the `**Plan:**` line. Plan approval
is that line, not a status.

**The review writes into it.** `code-review` reports its findings, and the
Mason records each one in the Diff-Review Findings section with its fix
or its answer.

## Work Document Template

All work documents MUST follow this structure:

```markdown
# <Task name> — work

Created by the Mason at the plan step, <date>. Spec:
`<same directory>/<same name>.spec.md`.

**Plan:** waiting for the Architect's reading.
<!-- Once approved: approved by <who>, <date>[, with the corrections below]. -->

## Program Design

Written at the plan step, from the spec's system design. Decisions, not
descriptions: modules built/modified and their interfaces, schema changes,
API contracts, edge cases to handle, the test order. Pseudo-code belongs
here when it encodes a decision more precisely than prose can (state
machine, schema, type shape). Revised in writing whenever reality
contradicts it — never carried in the session's head alone — and a revision
that changes what the Architect approved goes back to it.

## Worklog

Dated entries, one per work session: what was attempted, what landed, what
was reverted and why. A commit at every green step, not a pile-up saved for
the end.

## Implementation Checkboxes

- [ ] Step 1
- [ ] Step 2

Ticked as work lands. Not decoration: they are the resume point. A fresh
session picking the work back up reads this file and restarts at the first
unticked box.

## Notes & Snippets

Working notes, code snippets, exploration findings. May be verbose — nobody
else is required to read it start to finish.

## Diff-Review Findings

The findings of `code-review`, judged against the spec document with this
file as evidence, each with its fix or its answer.
```

## When Creating a Work Document (the Mason)

1. Create it at the plan step, never before — an open question about the
   *what* at this point means the spec is unfinished; report it rather than
   guess.
2. Name it by replacing the spec's `.spec.md` suffix with `.work.md`, same
   directory.
3. Persist the program design here, in vertical steps — never layer by
   layer — and stop for the Architect's reading before any code.
4. Tick implementation checkboxes as work lands; they are the resume point.
5. Commit at every green step. Never carry an open *how* question in your
   head — revise the design here, in writing.

## When Reading a Work Document

- The Architect reads the Program Design at the plan step, corrects it with
  the Mason, and records the approval on the `**Plan:**` line.
- The reviewers read the spec document as the requirement and this file as
  evidence.
- A fresh session resuming the work reads the implementation checkboxes and
  restarts at the first unticked one — never re-derives the plan from
  scratch.
