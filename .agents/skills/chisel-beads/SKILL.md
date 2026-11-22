---
name: chisel-beads
description: Read and update a task in a repo whose tracker (the tracker section of `.agents/project.md`) is a committed `bd` database — read a task, set its status, comment, link — and before running `git push` there.
---

# chisel-beads — beads as the tracker

This page applies when the tracker section of `.agents/project.md` names
beads. It is the adapter `.agents/workflow.md` reads and updates a task
through; nothing else in this repo talks to `bd`. Checked against `bd`
1.2.2.

**What lives where.** The bead holds the status, the claim, the blocking
edges and the comments. The spec and work documents hold everything else
and stay in the task workspace. Never paste what the work IS into a bead:
point at the document that says it.

## Read a task

```sh
bd ready                 # what can start now: open, nothing open upstream
bd show <id>             # one task: status, assignee, its Spec: line
bd list --status draft   # any other status is a filter
```

## Create a bead for a task

```sh
bd create "<the task's title>" --type task --priority <0-4> \
  --spec-id "<path to the spec document, from the repo root>" \
  --actor <architect|mason|typist> --silent
```

`--spec-id` is the whole link; the work document's path follows from it.
Leave the description, `design` and `acceptance_criteria` empty. `--actor`
is the role, not a person. `external_ref` is reserved for a link to another
tracker. The spec document's status line then reads
`**Status:** tracked as <id>`.

## Set its status

The seven statuses of "Statuses" in `.agents/workflow.md`, in the database:

| Workflow | `bd` | Note |
|---|---|---|
| `draft` | `draft` | declared custom |
| `ready` | `open` | built in; `bd ready` sees only `open` |
| `in-progress` | `in_progress` | built in; `--claim` sets it |
| `done` | `done` | declared custom |
| `blocked` | `blocked` | built in |
| `deferred` | `deferred` | built in |
| `cancelled` | `cancelled` | declared custom |

```sh
bd update <id> --status <value> --actor <role>
bd update <id> --claim --actor <role>       # takes it and sets in_progress
bd show <id> | grep 'Assignee:'             # always, right after a claim
```

A claim is not atomic: if the assignee that comes back is not the role you
claimed as, you do not have the task — leave it and report the collision.

## Comment and link

```sh
bd comments add <id> "<text>" --actor <role>
bd dep add <blocked-id> <blocker-id>        # <blocked-id> waits on <blocker-id>
```

A blocker's written trace still goes in the task's own documents
(`.agents/workflow.md`, "Blockers and questions"); a comment points at it.

## The session routine

Fresh clone, first session: `bd bootstrap`. Start of every other session:
`bd dolt pull`. End of a session that created, claimed, updated or
commented:

```sh
git ls-remote origin refs/dolt/data
bd dolt push
git ls-remote origin refs/dolt/data
```

If the ref did not move although this session changed something, the push
failed silently: check `bd dolt status`, commit what is pending, push again.

**Never `git push --mirror`** from a working clone: it deletes
`refs/dolt/data` on the remote — the whole issue history — and git reports
success. Protect the remote once (`git config receive.denyDeletes true`, or
your host's ref protection).

## Entering this case

From a clean working tree (`bd init` commits, and swallows anything staged),
at the repo root, one command at a time:

```sh
bd init --prefix <short-id> --skip-agents --skip-hooks
bd config set status.custom "draft:active,done:done,cancelled:done"
bd config get status.custom
```

Check that `bd` added no instructions of its own: no `BEGIN BEADS` block in
`AGENTS.md` or `CLAUDE.md`, no `SessionStart` hook, no `beads` skill under
`.agents/skills/`. Remove any you find. Then write the tracker section of
`.agents/project.md`, create one bead per OPEN task (the archive is never
read), wire the blocking edges with `bd dep add`, and rewrite each open
spec's status line to `**Status:** tracked as <id>`. Commit on exact paths,
never `git add -A`.

**Leaving this case:** write each open task's status back on its spec's
status line, set the tracker section back to the task files, and remove
`.beads/` in one commit.
