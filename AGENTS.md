# Agent instructions (grocery)

**The instructions for this repository live in [CLAUDE.md](./CLAUDE.md). Read that file now
and follow it.**

This file is only a pointer, so that every agent — whatever filename its tool looks for —
reads the same rules. `CLAUDE.md` covers:

- how to write back (plain English, short sentences, the answer first);
- the documentation to read before answering (`README.md`, `apps/documentation/INDEX.md`,
  and the guidelines cited there);
- the git rules: commit on your own, never push / open a pull request / merge unless asked,
  never add a `Co-Authored-By:` line;
- the stack and the database rules (schema changes go through MikroORM migrations).

Do not add project instructions here — half the tools would never see them. Put them in
`CLAUDE.md`. If a tool appends generated sections to this file (Spec-Kit's
`update-agent-context.sh` does that for some agents), move them to `CLAUDE.md` and leave
this file a pointer.
