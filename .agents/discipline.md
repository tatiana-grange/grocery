# Discipline — the ambient core

These rules apply to **every** conversation in this repo, with or without a
task artifact. A one-shot fix runs under the same discipline as a sliced
feature; the only difference is the paperwork.

1. **Read before acting.** At session start, read the reading list declared in
   §C · Reading list of `.agents/project.md` (by default the README and the
   most recent journal entries). Say which documents and rules you are working
   under.

2. **Plan first.** Even for a one-shot fix: say what you are about to do
   before doing it. Nothing half-decided crosses into code. When the work has
   a spec document, the program design is PERSISTED into its matching work
   document and approved by the Architect before any code — the "Plan" and
   "Read the plan" steps of `.agents/workflow.md`.

3. **🧑 zones are law.** Sections marked 🧑 in a spec document carry the
   decisions of whoever approved them — the human, unless the Architect
   approved a spec that carried no new decision ("Zone ownership" in
   `.agents/reference.md`). Never contradict one silently: if the work
   reveals a conflict with a 🧑 zone, stop and surface it.

4. **Verify before "done".** Run the project's gate commands declared in
   `.agents/project.md` §F (lint, tests, build; a browser check when UI
   behaviour changed). Evidence first — red output is reported as red, never
   narrated as green.

5. **The bridge rule.** No task artifact for casual conversation or one-shot
   work. But when a conversation turns into real, scoped, multi-step work,
   recognize it and PROPOSE a task under `.agents/workflow.md` — inform,
   never force. Formality is opt-in; detection is not. Most work should stay
   small: if everything becomes a big feature, review gets diluted and the
   method has failed.

6. **Escalate, don't improvise.** Blocked twice on the same thing, or pushed
   outside the approved plan → stop and report to whoever launched you. The
   block leaves a written trace in the task's own documents, and the ruling
   is recorded beside it — "Blockers and questions" in `.agents/workflow.md`.
   Never force a passage on your own authority.

7. **Session hygiene.** Build from the spec/work pair — that is why the plan
   is persisted. The pair is the unit of context: resume from the spec and
   work documents, never an ambiguous "the file". Past roughly 120k tokens an
   agent reasons worse: don't push through, use the `handoff` skill and open
   a fresh session on its summary.

8. **The repo is the only memory.** Never store project knowledge in a
   harness memory (auto-memory or any equivalent outside the repo); it goes
   in the repo's files, visible to review and git. Lessons about the way of
   working go through `retro` at close.

9. **Merging and publishing wait for the human, unless the project says
   otherwise.** Merging into the main branch, publishing a package,
   anything that leaves the working branch waits for the human's explicit
   word on that very action — never inferred from a "go" given on another
   subject. The one exception is what the merge and publish section of
   `.agents/project.md` explicitly hands to the agent.

10. **Writing: name things by their meaning, cite by file and title.** On
    every document written in this repo and every report to a human. **Name
    things by their meaning, not by a code** — an acceptance criterion is
    `no-orphan-file`, not `AC2`; a decision is named by what it decided.
    When a code must be cited, its meaning comes with it every time. **A
    reference names the file and the section title** — "§A · Task workspace
    of `.agents/project.md`" — never a bare number and never a line number,
    which is wrong by the next edit; later mentions in the same document may
    shorten to the letter or the title. **Every cross-reference says in one
    sentence what the reader finds there.** **The socle's words stay in the
    socle's language:** `seam`, and every term the glossary of
    `.agents/reference.md` defines, is never translated, whatever language
    the text is written in.

## The workflow, for real scoped work

`.agents/workflow.md` says how one task goes from intent to commit: the
roles, the steps, where the work stops, the tracker and the statuses. The
spec document owns the requirement; the work document owns the program
design and the progress; the know-how of each step lives in the skill it
names.

## Side lanes

Not everything starts as a feature idea:

| Situation | Use | Then |
|---|---|---|
| Something's broken (hard bug, flake, regression) | `diagnosing-bugs` — build a repeatable failing check first, THEN theorize; regression test before the fix | the fix lands as normal work |
| A design question that talking cannot settle | `prototype` — throwaway code, one command to run; keep the answer, and keep the code on a throwaway branch out of main with a pointer to that branch | back into the spec |
| Reading legwork (docs, API facts) | `research` — background agent, cited markdown file | feeds the spec |
| So big and foggy it cannot even be sliced | `wayfinder` — map the open DECISIONS first, resolve them one by one | then the spec document and its slices |
| A spare moment to make the codebase nicer to work in | `improve-codebase-architecture` | produces an idea → normal flow |
| A whole repo to judge, rather than one change | `codebase-audit` — blind finders one per lens, every claim reproduced, findings triaged against what was already decided | decisions and an action plan; each piece becomes a task by the normal path |

Skills live in `.agents/skills/`. The reasoning behind all of this — why a
reading gradient, why seams, why the plan is persisted, why the review runs
in fresh sub-agents — is `.agents/methodology.md`.
