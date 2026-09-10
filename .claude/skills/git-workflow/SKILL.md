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
2. Confirm the user actually asked for the commit / push / PR. Do not do it unprompted.
3. Check the branch (`git branch --show-current`).

## Branches

- Never commit directly to `staging` or `main`.
- Branch off `staging`. Name it loosely after the work: `feat/…`, `fix/…`, `docs/…`,
  `refactor/…`, `test/…`, `chore/…`. With squash merge the branch name never reaches
  history, so it is a convention, not a gate.

## Commits

- Format: `type(scope): subject`, Conventional Commits 1.0.0. A lefthook + commitlint
  hook checks the message.
- `type` and `scope` must be values from `commitlint.config.ts`. Do not copy the lists
  into prose — point at that file. **The scope is required** (`scope-empty: never`).
- The subject says what changed. Write a **body** that says why — the approach, what you
  rejected, the constraint that drove it — whenever the commit makes a decision.
- WIP / half-step commits on your own branch may use loose subjects; they die at squash.
- **Do not co-author commits with Claude.** No `Co-Authored-By:` trailer, no attribution
  line. The project constitution forbids it. If a global setting adds one, strip it from
  the message.
- Never write the token `BREAKING-CHANGE:` unless you intend to force a major release.
  For an intentional major, use `type(scope)!: subject` instead.

## Pull requests

- Open every feature PR against `staging`, never `main`.
- The repo squash-merges every feature PR and the squash commit is **the PR title plus the
  PR description**, verbatim. So the title and description are the future git history and
  the changelog source.
- Title: `type(scope): description` with a valid scope. CI lints it on every update.
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
