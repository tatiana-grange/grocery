---
name: chisel-setup
description: Fill in .agents/project.md, the per-repo glue, section by section with the user. Also places what a first `chisel init` found from another method before anything is installed, poses the dev's personal .agents/user.md, and reconciles a hand-written AGENTS.md with chisel's block. Re-runnable to revisit a section.
disable-model-invocation: true
---

# Chisel setup

Turn `.agents/project.md`'s defaults into this repo's actual glue, pose the
current dev's personal file, and leave `AGENTS.md` speaking with one voice.
One pass, sections A through I, each confirmed before the next. Re-running
later to revisit a single section is normal — treat the current file as the
starting recommendation, not as done-forever. On a repo that already had a
method of its own, a first `init` stages instead of installing, and this skill
places what it found with the user before the walk (Step 0).

## How to talk to the user here

Everything the user is shown is quoted as a **blockquote** in this file. That
is not decoration: it is the boundary between what the user reads and what you
read, and it is what makes the rule below checkable.

**Speak the user's language, not the toolkit's.** On screen: no "glue", no
"socle", no "ledger", no "bead", no section letters, no field
names. Every option gets one line saying what it buys and what it costs, in
words someone who has never read this repo would understand. The section
letters and titles of `.agents/project.md` (§A · Task workspace,
§B · Tracker…) are for the file and for you.

## Step 0 — Precondition, or placement first

Check `.agents/.chisel.json` exists. If it does, go to Step 1.

If it does not, look for `.chisel-workspace/session.md`. When it is titled
`# Chisel install session`, `chisel init` found a method this repo already
has and installed nothing: run the placement in [PLACEMENT.md](PLACEMENT.md),
then come back to Step 1. When there is neither a manifest nor an install session, stop here and tell
the user to run `deno x jsr:@lonestone/chisel init` first — this skill
configures the glue, it never installs the socle. Do not attempt to bootstrap
`.agents/` yourself.

## Step 1 — Silent exploration

Before asking anything, scan the repo and note what you find. Do not narrate
the scan step by step — gather everything first, then state the findings as
facts when you reach the section they affect.

- **Boilerplate marker**: does `apps/documentation/` exist? If so, this is a
  **boilerplate-mode** repo — §D and §G point into it, §C is prefilled from
  its known layout. Otherwise this is **brownfield mode**.
- **`package.json` scripts**: read `lint`, `test`, `typecheck`, `build`, and
  any dev/browser-check script → prefills for §F.
- **Existing docs**: `README.md`, `doc/`, `docs/`, `CONTEXT.md`, `docs/adr/`
  → candidates for §C (reading list) and §G (glossary/ADRs).
- **Existing task workspace from a previous methodology** (e.g. a
  `doc/project-management/` from an earlier convention; already settled by
  the placement when it ran): if one exists, flag it for §A instead of
  silently assuming the default root.
- **`bd --version`**: run it, record what it says (or that the command does not
  exist), and do nothing else with it. It feeds §B's beads answer only.
  Never install anything.
- **Trackers already in use**: a `.beads/` directory, or an MCP server for
  Plane, GitHub or another tracker in the tool's configuration. If one is
  there, §B's recommendation becomes "keep what you have".
- **`.agents/user.md`**: if it already exists, Step 5 reports it and touches
  nothing.
- **`AGENTS.md`**: does anything stand outside chisel's own `chisel:begin` /
  `chisel:end` markers besides the file's title? Note it either way — Step 7
  needs to know before it starts whether it has anything to sort.

**Fact vs decision** (same discipline as the `grilling` skill): what the scan
established is *stated* to the user, not asked. Only genuine decisions —
things the scan cannot determine on its own, or choices with real
alternatives — get a question.

## Step 2 — Walk sections A through I, one at a time

For each section, in letter order:

1. State any relevant facts from Step 1's scan.
2. Give your **recommended** value — prefilled from the scan plus the
   questionnaire defaults (root `/project-management/`; the task files as
   the tracker; boilerplate reading list into
   `apps/documentation`; living docs = `apps/documentation` for
   boilerplate else `doc/**`; gate commands from `package.json`; glossary/ADRs
   into `apps/documentation` for boilerplate else root `CONTEXT.md` +
   `docs/adr/`; model tiers unset; merge and publish left to the human).
3. Wait for the user's answer before moving to the next section. Accepting a
   recommendation in one word ("yes", "ok", "sounds good") is enough to move
   on — do not demand elaboration when the user is happy with the default.

**Never present two sections in the same message.** Each section gets its
own turn, exactly like the grilling discipline this skill borrows: one
question, wait, then the next.

Per-mode prefills:

- **Boilerplate mode** — §D and §G point into `apps/documentation` (THE doc
  reference: business + architecture, no split). §C is prefilled from the
  boilerplate's known layout (its `apps/documentation` entry point +
  `README.md`).
- **Brownfield mode** — §C is not a plain open question. Present the scanned
  candidates (README, whatever doc entry points the scan found) as a DRAFT
  reading list, then refine it with the user — a short back-and-forth, not a
  single blind ask. This is the "scan and assist" behavior the brownfield
  acceptance criterion asks for.

Skip §E entirely here — see Step 3.

### §B — ask this, verbatim

> **Where do your tasks live?**
>
> Each task has a written spec in this repo whatever you answer. The
> question is where its status lives, and what the agent uses to read and
> update it.
>
> 1. **In the task files** — the status is a line in each spec. Nothing to
>    install, everything shows up in a normal diff.
> 2. **In a small database committed next to the files** — "what can
>    start now?" is one command. The cost: one tool to install, and one habit
>    — pull when you start, push when you stop.
> 3. **In Plane, GitHub Issues or another tool you already use** — the agent
>    reads and updates the task there, through that tool's connector, and
>    the task points at its spec in this repo.
>
> Recommended: **1 — in the task files**, unless the team already tracks its
> work somewhere.

Write the answer on §B's three lines — *Tasks live in*, *Read and updated
with*, *Link back* — as the comment in that section describes:

- **1**: leave the defaults.
- **2** (beads): run **Step 6** before moving on to §C.
- **3**: name the tool and the connector or skill that reads and updates it
  (for Plane, its MCP server), and where the link back to the spec is
  written. If the tool has no connector set up yet, record the tracker and
  write `_(to set up)_` on the *Read and updated with* line — never a
  connector that does not exist. Do not improvise a wiring, and do not
  refuse a tool that is not on the list.

### §H — ask this, verbatim

> **Does the team want to pin which model does which kind of work?**
>
> The toolkit asks for a *level* rather than a name — the strongest model for
> thinking and reviewing, the cheapest for typing out a plan that is already
> written. Each of you answers that for your own tool, in your own file, which
> is never committed. This section only matters if the team has agreed on one
> answer for everybody.
>
> Recommended: **leave it unset**.

### §I — ask this, verbatim

> **Once a task is reviewed and its checks pass, may the agent merge it, or
> publish a release, without asking you?**
>
> 1. **No, it asks each time** — the agent opens the pull request and waits
>    for your word on the merge and on any release.
> 2. **It may merge, not publish** — a clean review and green checks are
>    enough to merge; a release still waits for you.
> 3. **It may merge and publish.**
>
> Recommended: **1 — it asks each time**, unless the team already merges
> on green checks.

Write the answer on §I's two lines: *ask the human* for what stays with the
human, *the agent, once the review is clean and the gates pass* for what is
handed over.

## Step 3 — §E is read-back only, never asked

Section E (Adapters) is written by `chisel init`, not by this questionnaire.
When you reach it in the walk, read the current checklist state back to the
user as a fact (which of the three adapters are present) — do not ask a question
about it. If an adapter is missing, do not fix it here: note it as something
`chisel check` should catch, and move on to §F.

## Step 4 — Surgical writes to `.agents/project.md`

After a section is accepted, write it immediately — do not batch writes
until the end of the walk. Each write is scoped to exactly one section:

- Find that section's `## <letter> · ...` heading.
- Replace everything from immediately after that heading line up to (but not
  including) the next `## ` heading, or end of file if there is none.
- Leave every byte outside that span untouched: other sections, any content
  a human added above §A or after §I, custom sections the file doesn't
  define (e.g. a hand-added `## I · ...`).

**Never rewrite the whole file.** A full-file rewrite is the one mistake
that would silently discard user edits living outside the questionnaire's
own sections — the whole point of this step is that it can't happen.

On a re-run, the section's *current* content in `project.md` — not the
template default — is what you present as the new recommendation in Step 2.
Accept-in-one-word keeps working on a re-run exactly as it does on a first
run.

## Step 5 — The personal file (also runnable on its own)

This step stands alone. "Set up my personal file", or a second dev's first
session on an already-configured repo, runs THIS step and nothing else — no
questionnaire, no package, no network.

1. If `.agents/user.md` already exists, say so and change nothing. It is the
   dev's own file; it is never overwritten, never merged, never re-templated.
2. Otherwise copy `.agents/user.md.tpl` to `.agents/user.md`. The template is
   installed by `chisel init` and is entirely commented out, so the fresh copy
   changes nothing until its owner edits it.
3. Make sure `.agents/user.md` is ignored by git: if no existing rule already
   covers it, append the line `.agents/user.md` to the repo's `.gitignore`
   (create the file if there is none). Append once — never a duplicate line on
   a re-run.
4. Tell the user, in one line:

> **Your own file.** I created `.agents/user.md` from the template and added it
> to `.gitignore`, so it is never committed. It is where you say which model
> your tool should use for each level of work; left as it comes, it changes
> nothing. Teammates get theirs the same way — copy `.agents/user.md.tpl`, or
> ask any session to do it.

Never commit `.agents/user.md`, and never copy one dev's file for another.

## Step 6 — When §B is beads

Only when the user picked beads. This step CREATES state — it is the one
place in this skill that does. What it runs is written in
`.agents/skills/chisel-beads/SKILL.md`, section "Entering this case": read
that page first, then follow it command by command, watching each output.

1. **Check the prerequisite.** The tool is `bd`, minimum version **1.2.2**.
   Compare what `bd --version` printed in Step 1 against it.
2. **If `bd` is missing or older, never install it yourself.** Show this,
   then wait:

> **This one needs a tool installed: `bd`, version 1.2.2 or newer.** I will not
> install it for you — that is your machine's business, not this repo's.
> To install it: `curl -sSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash`, or your usual package manager.
>
> Say the word and I will keep the statuses in the task files for now instead.

3. **Require a clean working tree, and say why before you check.**

> **One condition before I create it: nothing uncommitted.** The tool makes a
> commit of its own as it sets itself up, and anything staged would land in
> it. Commit or stash what you have in progress, and tell me when to go.

   If `git status --porcelain` is not empty, stop here and wait. Do not stash
   anything on the user's behalf.

4. **Run "Entering this case"** of the chisel-beads page, then confirm what is
   now true by reading it back: `chisel check` is clean, and `bd ready`
   answers.
5. **Write §B**: *Tasks live in* beads; *Read and updated with*
   `.agents/skills/chisel-beads/SKILL.md`; *Link back* the bead's `Spec:`
   field.
6. **Say what happened**, and hand over the one thing they now have to know:

> **Done.** The statuses now live in a small database committed next to your
> task files. The habit it costs you: pull when you start a session, push
> when you stop. One rule to never break: never `git push --mirror` from a
> clone — it deletes the database's history on the server.

## Step 7 — One voice in `AGENTS.md` (also runnable on its own)

This step stands alone. "Reconcile my `AGENTS.md`" runs THIS step and nothing
else — no questionnaire, no sections, no network. In the walk it comes after
§I is written and before the summary.

A repo that had an `AGENTS.md` before chisel now has two voices in one file:
the text it already carried, often describing its own way of working, and the
block `chisel init` appended, describing another. This step sorts the earlier
text with the user, line by line, and leaves one voice.

1. **Read the file, and find the block.** Chisel's own span is everything
   between the `chisel:begin` and `chisel:end` markers. This step never edits
   inside it — `init` writes that span and `update` rewrites it, so a hand edit
   there is lost at the next update. What this step works on is everything
   outside the markers.

   When nothing stands outside them but the file's title — or nothing at all —
   say this and end:

> **Your instructions file already speaks with one voice.** Outside the part
> chisel keeps up to date there is nothing but the title, so there is nothing
> for me to sort. I changed nothing.

2. **Sort what stands outside into three piles**, paragraph by paragraph and
   bullet by bullet, the three tests below deciding which. The sort is done
   when every line sits in exactly one pile and none is left over.

   - **Covered** — the block, or one of the files it routes to
     (`.agents/discipline.md`, `.agents/workflow.md`, `.agents/project.md`,
     `.agents/reference.md`, `.agents/methodology.md`), now says this. Quote the sentence that replaces
     it: a line is covered only when you can point at its replacement, which is
     what keeps the project's own text from being deleted for looking familiar.
   - **The project's own** — build and run commands, domain facts, conventions
     the toolkit does not carry. It stays where it is. When the line points at
     a document, propose it instead as an entry of §C · Reading list of
     `.agents/project.md`, so the pointer lives in the file made for pointers
     and every session reads it at the start.
   - **Contradicting** — the line says the opposite of what the block or one of
     its files says. Name it a contradiction, quote both sentences, and let the
     user decide which one stands.

3. **Put each pile to the user**, one pile per message, waiting for the answer
   before the next — the same one-question-at-a-time discipline as the walk. A
   pile whose lines split between verdicts is one message per line instead.

   Covered:

> **Some of what your instructions file says, the toolkit now says for you.**
> The same instruction, written twice:
>
> - your file says: "…" → now said by `.agents/discipline.md`: "…"
>
> Deleting them leaves one instruction where there were two, so nobody has to
> guess which one wins. Keeping them costs nothing today, and one silent
> disagreement the day chisel's version of the sentence changes.
>
> Recommended: **delete them**. One word and they go; name any you would
> rather keep and I leave it exactly where it is.

   The project's own:

> **The rest is yours, and I am leaving it alone.** These say things only this
> project knows — how to build it, how to run it, facts about the work itself
> — and chisel says none of them:
>
> - "…" — stays where it is
>
> Some of them point a reader at a document. Those work better in this
> project's reading list, which every session opens at the start: the pointer
> gets read instead of being hoped for.
>
> - "…" → moved to the reading list in `.agents/project.md`
>
> Recommended: **keep them all, move the pointers**. One word and I move them;
> say so and I move nothing instead.

   Contradicting:

> **Here your instructions file and chisel say the opposite of each other.** I
> am not choosing for you:
>
> - your file says: "…"
> - chisel says, in `.agents/discipline.md`: "…"
>
> Only one of the two can stay: two live instructions that disagree means each
> session picks one, and you never know which.
>
> 1. **Yours wins** — I leave your line untouched. What you write outside the
>    part chisel keeps up to date takes precedence for your agents, which is
>    exactly how a project bends the toolkit to itself.
> 2. **Chisel's wins** — I delete your line, and the installed instruction is
>    the only one left.
>
> Recommended: **1 — yours wins**, unless that line was written for a way of
> working you have just replaced.

4. **Write only what was agreed.** After a yes, delete or move exactly the
   lines the user named and nothing else, and only outside the markers. A
   pointer going to the reading list is written with Step 4's span on §C of
   `.agents/project.md`, so every other section of that file stays
   byte-identical. `AGENTS.md` is edited line by line, never rewritten whole:
   a full-file rewrite here would discard the very text the user just asked you
   to keep, which is the reason Step 4 forbids it on the other file too.

5. **Say what happened**, in one line:

> **Your instructions file now speaks with one voice.** Deleted: … Moved to
> the reading list: … Kept as yours: … The part chisel keeps up to date was
> not touched.

Re-run safe: a file that already speaks with one voice yields one pile — the
project's own — and the step reports that and changes nothing.

## Step 8 — Closing summary

After §I is written, print a one-screen summary of what got written: one
line per section, A–I; one line for the personal file; one line for
`AGENTS.md`, saying what was deleted, what moved to the reading list and what
stayed, or that the file already spoke with one voice; and, when §B named a
tracker still to set up, the one thing still to do. Then suggest the natural next move:
create a first task, or run `chisel check` to confirm the adapters are all in
place.
