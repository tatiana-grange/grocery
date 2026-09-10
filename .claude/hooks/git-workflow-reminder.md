GIT WORKFLOW REMINDER (project: grocery)

You are about to run a git/gh command that writes history. Follow the project's git
workflow before you continue. Full detail: `.claude/skills/git-workflow/SKILL.md` and
`CONTRIBUTING.md` (read `CONTRIBUTING.md` now if you have not this session).

Key rules:

- Branch first. Never commit straight to `staging` or `main`. Branch off `staging`.
- Open every feature pull request against `staging`, never `main`. `main` advances only
  through the non-squash promotion PR (`staging` → `main`), and through the release-please
  Release PR, which is machine-generated — you do not open PRs against `main` yourself.
- Commit messages: Conventional Commits `type(scope): subject`. The type and scope must be
  valid values from `commitlint.config.ts`; the scope is required. Write a body that says
  why (approach, what was rejected, the constraint) whenever the commit makes a decision.
- Do NOT co-author commits with Claude. No `Co-Authored-By:` line, no attribution trailer.
  The project constitution forbids it.
- Never run `pnpm fmt` across the whole repo (it rewrites dozens of unrelated files).
  Format only the files you changed.
- Commit the `specs/` directory. Spec-Kit artifacts (`specs/<feature>/spec.md`, `plan.md`,
  `tasks.md`, …) are tracked on this project and ride along on the feature PR.
- Never commit `.env` files or secrets of any kind.
- Never write `BREAKING-CHANGE:` in a commit or PR unless a major release is intended.
- Commit, push, or open a PR only when the user asked you to.
