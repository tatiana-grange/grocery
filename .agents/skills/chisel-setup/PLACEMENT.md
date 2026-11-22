# Placement — before the first install

Read when `.chisel-workspace/session.md` is titled `# Chisel install
session`: a first `chisel init` found a method this repo already has and
installed nothing. `init` names what it found; it does not judge. Deciding
where each thing goes is this step's job, with the user, one thing at a
time. Nothing is written until the user has answered for every item.

1. **Read the session's list, then each item.** Open enough of each one to
   say what it holds and whether it is alive: the last dated entry of a task
   folder, the number of specs, whether an instructions file describes a way
   of working or only build commands. The reference install the session
   staged, under `.chisel-workspace/reference/`, shows what chisel would put
   beside it.

2. **Put each item to the user**, one message per item, waiting for the
   answer before the next. Say what you found in a sentence, then the three
   choices, each with what it buys and what it costs:

> **I found <what, in plain words> in `<path>`.** <One sentence on what it
> holds.>
>
> 1. **Keep it where it is** — chisel points at it, so every session reads
>    it, and nothing moves.
> 2. **Migrate it into chisel's format** — <where it would go>. One way of
>    working instead of two; the cost is the move and a review of the diff.
> 3. **Leave it beside chisel** — untouched, and chisel never mentions it.
>
> Recommended: **<n> — <label>**, because <the reason, from what you read>.

   Where to start the recommendation, before what you read changes it:

   | Found | Recommended | Kept in place means |
   |---|---|---|
   | OpenSpec, Spec Kit | keep | a line in §C · Reading list pointing at the specs; tasks still go through chisel's specs |
   | task folder | keep | §A · Task workspace names that folder |
   | decision records, glossary | keep | §G · Glossary & decisions points at them |
   | other agent's rules | keep | a line in §C; a rule chisel now covers is sorted as Step 7 of the skill (one voice in `AGENTS.md`) sorts a line |
   | instructions file | keep | Step 7 of the skill sorts its lines against chisel's block, later in this walk |
   | beads | keep | §B is beads, through Step 6 of the skill |
   | first chisel version | migrate | — its rules and visual guide are retired; the current files replace them |
   | linked path | ask where the link points before anything else | the link gives way to the file it points at, or the path moves out of chisel's way |

   A linked path is settled first, and it must end with no link on a path
   chisel writes: `init --arranged` still refuses one.

   Before installing, name what `init --arranged` will overwrite: it always
   writes `project-management/000-template.spec.md`,
   `project-management/000-template.work.md` and `scripts/task-id.sh`. When
   the repo already has its own file at one of those paths, put that to the
   user as one more item: let chisel's file replace it, or `git mv` theirs
   to another name first.

3. **Install.** Once every item has an answer, note the command
   `session.md` gives for chisel, its pinned version included, then delete
   `.chisel-workspace/` and run that command with `init --arranged .`. It
   installs as if nothing had been found.
   Done when it exits 0 and `.agents/.chisel.json` exists.

4. **Write only what was accepted.** A *keep* becomes its pointer, written
   with the surgical span of Step 4 of [SKILL.md](SKILL.md) (one section
   rewritten, the rest left byte for byte) on the section the table names,
   as the walk reaches it. A *migrate* moves the files with `git mv` and
   rewrites only the links the move broke. A *leave* writes nothing. Show
   the user the diff of every move before the walk goes on.

5. **Continue with Step 1 of [SKILL.md](SKILL.md).** The answers stand as
   facts for the sections they touch: state them, never ask them again.
