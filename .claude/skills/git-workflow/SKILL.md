---
name: git-workflow
description: How this project commits, branches, and opens pull requests. Use whenever you are about to commit, stage, push, create a branch, open or finalize a pull request, or when the user mentions git, commits, or PRs.
---

# Git Workflow (grocery)

`CONTRIBUTING.md` at the repo root is the source of truth. Read it before your first
commit or PR in a session. This skill is the short version plus the project-specific
defaults that are easy to miss.

## Before you commit or open a PR

1. Read `CONTRIBUTING.md` if you have not yet this session.
2. Know what you may do unprompted: commit yes, push / PR / merge no (see Autonomy).
3. Check the branch (`git branch --show-current`).

## Autonomy: commit freely, share only on request

- **Committing is yours.** You do not need the user to ask. As soon as a coherent step is
  done on a feature branch, commit it with a valid message. Small, frequent commits are
  the expected rhythm — they are squashed at merge, so they cost nothing.
- **Pushing and publishing are the user's.** `git push`, `gh pr create`, `gh pr merge`,
  enabling auto-merge, and pushing tags happen only when the user explicitly asks for them.
  Finishing the work, or CI being green, is not a request.
- Same rule for anything else that leaves the machine: `gh pr edit` on an existing PR is
  part of finalization and still waits for the user to ask for that finalization.
- If you are unsure whether the user meant "commit" or "commit and push", commit and say
  the branch is ready to push.

## Branches

- Never commit directly to `staging` or `main`.
- **Default: branch off `staging`.** Refresh it first
  (`git switch staging && git pull --ff-only`), then cut the branch.
- Name it loosely after the work, prefixed with the commit type it will produce. The
  prefixes are exactly the types in `commitlint.config.ts` (`feat/`, `fix/`, `docs/`,
  `perf/`, `ci/`, …), so the branch and its commit agree. With squash merge the branch name
  never reaches history, so it is a convention, not a gate.

### Stacked branches (feature built on an unmerged feature)

When the new work needs code that is still sitting in an open pull request, do not copy it
and do not wait: stack the branches.

- Cut the new branch off the **parent feature branch**, not off `staging`.
- Open its pull request **against the parent branch**, so the diff shows only the new work.
  A PR based on `staging` while the parent is unmerged shows both features at once and is
  unreviewable.
- Say it in a **PR comment**, for example `Stacked on #12; retarget to staging once #12
  merges.` Not in the description: the description becomes the commit body verbatim, and
  the stack is a fact about the review, not about the change.
- When the parent merges, GitHub retargets the child PR to `staging` on its own. The branch
  itself still carries the parent's old commits, so replay it onto the squashed result:
  `git fetch origin && git rebase --onto origin/staging <parent-branch> <your-branch>`,
  then force-push **your own** branch (never `staging` or `main`).
- Keep stacks short. Two levels is normal, three is a warning sign: land the bottom of the
  stack before you add to the top.
- Everything lands on `staging` in the end. Stacking changes the base of the review, never
  the destination.

## Commits

- Format: `type(scope): <gitmoji> subject`, Conventional Commits 1.0.0 plus one gitmoji.
  Example: `feat(api): ✨ add a per-product quantity step`. A lefthook + commitlint hook
  checks the message.
- `type` and `scope` must be values from `commitlint.config.ts`. Each type has exactly one
  emoji, in the same file. Do not copy the lists into prose — point at that file.
  **The scope is required** (`scope-empty: never`).
- The emoji goes **after the colon**, never before the type and never instead of it. A
  header that opens with an emoji no longer parses as a conventional commit, and
  release-please silently drops it from the changelog and the version math.
- The subject says what changed. Write a **body** that says why — the approach, what you
  rejected, the constraint that drove it — whenever the commit makes a decision.
- WIP / half-step commits on your own branch may use loose subjects; they die at squash.
- **Do not co-author commits with Claude.** No `Co-Authored-By:` trailer, no attribution
  line. The project constitution forbids it. If a global setting adds one, strip it from
  the message.
- Never write the token `BREAKING-CHANGE:` unless you intend to force a major release.
  For an intentional major, use `type(scope)!: <gitmoji> subject` instead.

## Pull requests

- Open a PR only when the user asks for it (see Autonomy).
- Base: `staging` for a normal feature PR; the parent feature branch for a stacked one
  (see Stacked branches). Never `main`.
- The repo squash-merges every feature PR and the squash commit is **the PR title plus the
  PR description**, verbatim. So the title and description are the future git history and
  the changelog source.
- Title: `type(scope): <gitmoji> description` with a valid scope and the emoji of its type.
  CI lints it on every update.
- Description when ready to merge: rationale prose first (why this approach), then one
  unbulleted conventional paragraph per extra consumer-visible change. Screenshots,
  checklists, and review chatter go in comments, never the description.
- The `finalize-pr` skill does the finalize step (title + description from the full
  diff). Do not merge as part of finalizing.

## `main` and the promotion PR

- `main` is the release trunk (release-please, `CHANGELOG.md`, tags, versioned images).
  Nobody pushes to it and no feature PR targets it.
- It moves forward through a **promotion PR** from `staging` → `main`, opened periodically
  and always before a release. **Never squash the promotion PR** — fast-forward `main` to
  `staging` (`git switch main && git merge --ff-only staging && git push`) or "Rebase and
  merge". Squashing it would collapse every feature into one commit and break release-please.
- The release-please **Release PR** targets `main` and is machine-generated. A human merges
  it from the GitHub UI. You never open or merge it.
- Only open a PR against `main` yourself if the user explicitly asks (e.g. the promotion PR).

## Project-specific gotchas

- **Never run `pnpm fmt` repo-wide.** It rewrites dozens of unrelated files. Format only
  the files you touched.
- Never commit `.env` files or secrets.
- Do commit the `specs/` directory. Spec-Kit artifacts are tracked and land on the feature PR.
- CI (lint, knip, build, typecheck, test) and the e2e suite run on PRs to `staging` and to
  `main`. `pr-lint` and the release-note check run on every PR regardless of base.
- Pre-merge gates from the constitution: `pnpm lint`, `pnpm typecheck`, `pnpm test` pass;
  the feature's task list is complete; affected documentation is updated.

## Safety

- Never force-push `staging` or `main`. Never skip hooks (`--no-verify`). Never amend a
  commit that is already pushed.
- Review `git diff` before staging. Stage specific paths, not `git add -A`, unless you
  have checked everything that is unstaged.
