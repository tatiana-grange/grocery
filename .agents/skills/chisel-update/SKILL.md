---
name: chisel-update
description: Apply the intentions of a chisel update that `chisel update` staged in `.chisel-workspace/` instead of updating — one intention at a time, wherever the repo keeps its method, the human validating each move — then close the session.
disable-model-invocation: true
---

# Apply a staged chisel update

`chisel update` refreshes a repo by itself only when nothing needs
judgement: chisel installed it, no symbolic link sits on a path it writes,
and every pending intention is `automatic` or `informational`. Otherwise it
writes nothing in the project's files, stages a disposable workspace,
`.chisel-workspace/`, and exits with code 3. This skill takes over from
there.

An **intention** is one change of a release that the repo must act on: its
goal, when it applies and when it does not, the gaps to close — each with a
signal to observe and a "done when" — what it must not touch, the reference
paths to compare, and how to validate. Its classification says how much
judgement it needs: `automatic` (the closing update does it), `migration`
(you apply it, the human validating), `breaking-manual` (the human decides
before anything moves), `informational` (read it to the human).

## The workspace

| Path | What it holds |
|---|---|
| `.chisel-workspace/session.md` | The checklist: where the repo comes from, why `update` stopped, the pending intentions, and the exact command to run chisel with. |
| `.chisel-workspace/intentions/` | Each pending intention, as the release ships it. |
| `.chisel-workspace/reference/` | The tree `chisel init` lays in an empty repo at the version the repo moves to: the reference every intention compares against. |

The workspace is ignored by git and never committed. `chisel update`
refuses to run while it exists.

Run chisel with the command `session.md` names, pinned to the version that
staged the session; it is written `chisel` below.

## The steps

1. **Require a clean working tree** (`git status --porcelain` empty), so
   the human reads one diff and can revert it in one command.

2. **Read `session.md`.** State as facts, in a short table, where the
   repo's method lives: read `AGENTS.md` and `CLAUDE.md` inside and outside
   the `chisel:begin` / `chisel:end` markers, the task workspace and tracker
   sections of `.agents/project.md` when there is one, and the symbolic
   links of the repo
   (`find . -type l -not -path './.git/*' -not -path './node_modules/*'`).

3. **Close the reasons first.** A reason under "Why update stopped" that
   is a refusal comes before the intentions:
   - **No manifest, or the first version's layer:** the session lists the
     intention `baseline` first. Apply it before the others.
   - **A symbolic link on a path chisel writes:** a plain write follows the
     link and rewrites the file it points at. Show each link with its
     target, and the diff between the target and the same path under
     `reference/`. The human chooses which content stays; the link's target
     keeps its own content, untouched. Two cases are common:
     - **A linked `AGENTS.md` or `CLAUDE.md`**, often one pointing at the
       other. Replace each link by a real file holding the content the
       human chose
       (`cp "$(readlink AGENTS.md)" AGENTS.md.new && mv AGENTS.md.new
       AGENTS.md`).
     - **A linked skill of a name chisel ships**, such as
       `.agents/skills/tdd` pointing into `doc/agents/skills/tdd`. Remove
       the link (`git rm`): the close poses chisel's version. An edit the
       human keeps moves to a skill of the project's own, under a name
       chisel does not ship, or to the project's instructions outside the
       chisel markers of `AGENTS.md`.

     A skill chisel does not ship stays linked: chisel never writes it.
     Done when no path `reference/` has, and no directory above one, is a
     symbolic link.

   Where an intention says to run `chisel update`, leave that run to the
   close below: `update` refuses while the workspace exists. A reason that
   lists intentions is the list below it.

4. **Propose before any edit.** Read every pending intention: its goal,
   Applies When, Do Not Apply When and Observable Gaps. Inspect the repo.
   Present one table and wait for the human's answer:

   | Intention | Proposal | Why (one observable signal) |
   |---|---|---|
   | `<id>` | **apply** / **skip** / **ask** | … |

   Finding the state an intention moves away from is the reason to apply
   it, never a reason to skip. A skip needs a hard "Do Not Apply When" or
   the human's own decision.

   An intention the repo already applied by hand, before chisel shipped it,
   shows no gap signal, and its journal often says when it was done.
   Propose **apply** all the same: check each "done when" against the repo,
   say which journal entry did it, and record it applied. Nothing moves.

5. **One intention at a time**, in the session's order:
   - Re-check Applies When and Do Not Apply When against the repo as it is
     now. A hard stop that now matches goes back to the human; never skip
     silently.
   - On `breaking-manual`, stop: state the decision the human must make,
     with the options, and wait. Nothing moves before their answer.
   - **Close each gap where the project keeps its method.** An intention
     names chisel's default paths; when the repo keeps its tasks, its
     journal or its doctrine elsewhere, the glue, `AGENTS.md` and the links
     found when you read the session say where, and that is where the gap
     is closed. Move a project file only where a gap says to, and only to
     where the project keeps its method.
   - **Show each move before making it**, and make it on the human's yes.
   - Follow each reference path's policy against `reference/`: **copy**
     takes the reference file as it is; **adapt** keeps the project's own
     answers and brings only what the intention changes.
   - Validate with the intention's list, then record:
     `chisel record <id> --applied`. A skip the human confirmed:
     `chisel record <id> --skipped "<reason>"`. Each record ticks its line
     of `session.md`.
   - `automatic` intentions need nothing from you: the closing update
     records them. Read each `informational` one to the human.

6. **Stop** when validation keeps failing, when a move would lose
   something of the project's, or when you are unsure: say what blocks,
   with the intention's id and the checks that failed, record nothing for
   it, and hand back to the human.

## What is never touched

Say it at the start and hold to it:

- **The archive.** Every archived task keeps its bytes.
- **The content of open task files**, beyond what an intention names.
- **The project's own answers** in its glue: its paths, reading list and
  gate commands.
- **A skill chisel does not ship**, linked or not.
- **Anything that is not the method:** source code, CI, dependencies, git
  history.

## The close

Run these once every intention of the session is recorded, or left to
the closing update. When the session lists `baseline`, its Record Result
replaces steps 1 and 2.

1. Delete the workspace: `rm -rf .chisel-workspace`.
2. Run `chisel update`. It takes the fast path now: it refreshes the
   managed files, records the `automatic` and `informational` intentions,
   and exits 0. An exit 3 means something is still pending: read the new
   `session.md` and start again from "Read `session.md`".
3. Run `chisel check`: it must be clean.
4. Show the human the full diff; their reading of it validates the update.
5. Once accepted, add one dated entry to the journal the task workspace
   section of `.agents/project.md` names: the versions, each intention
   applied or skipped with its reason, what moved. End it with three lines
   for whoever works here next: what changed in how they work, what was
   skipped and why, and what is left for a human to decide.
6. Commit it as one commit, on exact paths — never `git add -A`.
