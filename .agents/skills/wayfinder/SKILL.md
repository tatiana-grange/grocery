---
name: wayfinder
description: Plan a huge chunk of work — more than one agent session can hold — as a shared map of decision tickets, in a folder of markdown files or on your issue tracker, and resolve them one at a time until the way to the destination is clear.
disable-model-invocation: true
x-upstream:
  repo: mattpocock/skills
  path: skills/engineering/wayfinder
  sha: 2ab958093e83e0ec752e6c1c5932da465bf23e0c
  changes: "adapted: when the glue's tracker is the task files, the map lives as a folder of markdown files under the task workspace; project paths resolve via .agents/project.md"
---

A loose idea has arrived — too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This skill charts the way as a **shared map** — a folder in the repo, or the repo's issue tracker — then works its **decision tickets** — questions whose resolution is a decision, not slices of a build to execute — one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting — it shapes every ticket. It might be a spec to hand off and iterate on, a decision to lock before planning starts, or a change made in place like a data-structure migration. The map is domain-agnostic — engineering work, course content, whatever fits the shape.

## Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and the map is done when the way is clear — nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off. An effort can override this in its **Notes** — carrying execution into the map itself — but absent that, produce decisions, not deliverables.

## Refer by name

Every map and ticket has a **name** — its title. In everything the human reads — narration, the map's Decisions-so-far — refer to it by that name, never by a bare id, number, or slug. A wall of `#42, #43, #44` — or of `04-…, 05-…` — is illegible; names read at a glance. The id and the link don't vanish — a name wraps its link — but they ride *inside* the name, never stand in for it.

## The Map

The map is a **single** artifact — one `MAP.md` in the map's own folder, or one issue labelled `wayfinder:map` on this repo's issue tracker — and it is the canonical one. Its tickets hang off it: files beside `MAP.md`, or child issues of the map issue.

The map is an **index**, not a store. It lists the decisions made and points at the tickets that hold their detail; a decision lives in exactly one place — its ticket — so the map never restates it, only gists it and links.

### Where the map lives

§B · Tracker of `.agents/project.md` — the one place that says where this repo's tasks live, and what reads them — decides the support. With an issue tracker declared there, the map is an issue and its tickets are child issues, exactly as the rest of this skill reads.

**When the tracker is the task files, the map is a folder**: `maps/<slug>/` under the tasks root declared in §A · Task workspace of the same file, which is where that repo keeps its task documents (default `/project-management/maps/<slug>/`), `<slug>` being the destination in a few words. `MAP.md` in it carries the map body below, unchanged. Each ticket is one file `<NN>-<title-slug>.md` beside it, `<NN>` in creation order:

```markdown
# <NN> — <Ticket title>

**Type:** grilling | research | prototype | task
**Blocked by:** <NN — title, …> or "None"
**Claimed by:** <who> or "—"

## Question

<the decision or investigation this ticket resolves>

## Resolution

<written when the ticket closes, never before>
```

Every tracker notion the rest of this skill uses has one counterpart in that folder:

- **The map issue** → `MAP.md`.
- **A child issue** → a file in the map's folder.
- **The `wayfinder:map` and `wayfinder:<type>` labels** → the folder itself, and the ticket's `Type` line.
- **The assignee that is the claim** → the `Claimed by` line, written and committed before any work, so a concurrent session sees the claim.
- **Native blocking** → the `Blocked by` line: a ticket is unblocked when every file it names is closed.
- **The frontier query** → listing the folder. The frontier is the files with no `Resolution` written, an empty `Claimed by`, and every blocker closed.
- **The resolution comment and the close** → the `Resolution` section written, plus the ticket's line added to the map's **Decisions so far** — which is what closed means for a file. A closed ticket stays in the folder: the map is the index, the tickets hold the detail.
- **The out-of-scope close** → the same two writes, the line landing under **Out of scope** instead.

A file's name carries its `<NN>` and its title's slug; the `#` heading is the title itself — the name that "Refer by name" refers by.

### The map body

The whole map at low resolution, loaded once per session. Open tickets are **not** listed — they are found on the frontier, never read off the map.

```markdown
## Destination

<what reaching the end of this map looks like — the spec, decision, or change this effort is finding its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [<closed ticket title>](link) — <one-line gist of the answer>

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
```

### Tickets

Each ticket belongs to the map — a file beside `MAP.md`, or a **child issue** of the map issue — and its identity travels with it: the file's name, or the tracker's issue id. Its body is the question, sized to one 100K token agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

Each ticket declares its **type** — one of `research`, `prototype`, `grilling`, `task` (see [Ticket Types](#ticket-types)) — carried as a `wayfinder:<type>` label in a tracker.

A session **claims** a ticket **first**, before any work, so concurrent sessions skip it. In a tracker the assignee _is_ the claim — the dev driving the map — so an open, unassigned ticket is unclaimed.

In a tracker, blocking uses its **native** dependency relationship — essential because it renders the frontier _visually_ in the tracker's own UI, so the human sees what's takeable without opening the map; only a tracker that lacks native blocking falls back to a body convention. A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed tickets — the edge of the known.

The answer isn't part of the body — it's recorded on resolution (see [Work through the map](#work-through-the-map)). Assets created while resolving a ticket are linked from the ticket, not pasted in.

## Ticket Types

Every ticket is either **HITL** — human in the loop, worked *with* a human who speaks for themselves — or **AFK**, driven by the agent alone. A HITL ticket only resolves through that live exchange; the agent never stands in for the human's side of it (a grilling agent that answers its own questions has broken this).

- **Research** (AFK): Reading documentation, third-party APIs, or local resources like knowledge bases to surface a fact a decision waits on. Resolved by a `/research` **subagent**. Use when knowledge outside the current working directory is required.
- **Prototype** (HITL): Raise the fidelity of the discussion by making a cheap, rough, concrete artifact to react to — an outline, a rough take, a stub, or UI/logic code via the /prototype skill. Links the prototype as an asset. Use when "how should it look" or "how should it behave" is the key question.
- **Grilling** (HITL): Conversation via the /grilling and /domain-modeling skills, one question at a time. The default case.
- **Task** (HITL or AFK): Manual work that must happen before a *decision* can be made — nothing to decide, prototype, or research, but the discussion is blocked until it's done. Signing up for a service so its API can be judged, provisioning access, moving data so its shape can be seen. This is the one type that *does* rather than decides — and it earns its place by unblocking a decision, not by delivering the destination. The agent drives it alone where it can (AFK); otherwise it hands the human a precise checklist (HITL). Resolved when the work is done; the answer records what was done and any resulting facts (credentials location, new URLs, row counts) later tickets depend on.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. Beyond the live tickets lies the **fog of war** — the dim view of decisions and investigations you can tell are coming but can't yet pin down, because they hang on questions still open. Resolving a ticket clears the fog ahead of it, graduating whatever's now specifiable into fresh tickets — one at a time, until the way to the destination is clear and no tickets remain.

The map's **Not yet specified** section is where that dim view is written down: the suspected question, the area to revisit later. It's the undiscovered frontier _toward_ the destination — everything here is in scope, just not sharp enough to ticket. Write as loosely or as fully as the view allows; it doubles as a signpost for collaborators reading where the effort is headed.

**Fog or ticket?** The test is whether you can state the question precisely now — _not_ whether you can answer it now.

- **Ticket when** the question is already sharp — even if it's blocked and you can't act on it yet.
- **Not yet specified when** you can't yet phrase it that sharply. Don't pre-slice the fog into ticket-sized pieces: it's coarser than a ticket, and one patch may graduate into several tickets, or none, once the frontier reaches it.

**Not yet specified** excludes what's already decided (Decisions so far), what's already a live ticket, and what's out of scope (the next section).

## Out of scope

Fog only ever gathers _toward_ the destination. The destination fixes the scope, so work beyond it is **out of scope** — it isn't fog, and it doesn't belong in **Not yet specified**. It gets its own **Out of scope** section on the map: work you've consciously ruled out of _this_ effort. Scope, not sharpness, lands it here.

Out-of-scope work never graduates — the frontier stops at the destination — so it returns only if the destination is redrawn, and then as a fresh effort, not a resumption.

Ruling something out of scope is a scoping act, not a step on the route. When a ticket that already exists turns out to sit past the destination — mis-scoped in while charting, or exposed by a resolution — **close it** (a closed ticket is unambiguously off the frontier) and leave one line in the **Out of scope** section: the gist plus why it's out of scope, linking the closed ticket. It stays out of **Decisions so far**, which records the route actually walked — a scope boundary isn't a step on it.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session** — with the exception of research tickets.

### Chart the map

User invokes with a loose idea.

1. **Name the destination.** Run a `/grilling` and `/domain-modeling` session to pin down what this map is finding its way to — the spec, decision, or change. The destination fixes the scope, so it's settled first.
2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** — the way to the destination is already clear, the whole journey small enough for one session — you don't need a map. Stop and ask the user how they'd like to proceed.
3. **Create the map** — `MAP.md` in the map's folder, or the map issue labelled `wayfinder:map`: Destination and Notes filled in, Decisions-so-far empty, the fog sketched into **Not yet specified**.
4. **Create the tickets you can specify now** — files in the map's folder, or child issues of the map — then wire blocking edges in a **second pass** (tickets need their names before they can reference each other). Wiring sorts them into the frontier and the blocked; everything you can't yet specify stays in the fog — the **Not yet specified** section.
5. **Fire the research subagents.** For each `research` ticket you just created, spin up a `/research` subagent to resolve it in parallel, capturing its findings on a throwaway `research/<name>` branch with a context pointer from the ticket.
6. Stop — charting is one session's work; it hand-resolves nothing.

### Work through the map

User invokes with a map (its folder, or a URL or number). A ticket is **optional** — without one, you pick the next decision, not the user.

1. Load the **map** — the low-res view, not every ticket body.
2. Choose the ticket. If the user named one, use it. Otherwise take the first frontier ticket in order. **Claim it** in your own name, before any work.
3. Resolve it — **zoom as needed**: fetch the full body of any related or closed ticket on demand; invoke the skills the `## Notes` block names. If in doubt, use `/grilling` and `/domain-modeling`.
4. Record the resolution: write the answer as the ticket's **resolution** — a resolution comment, in a tracker — **close** the ticket, and **append a context pointer** to the map's Decisions-so-far.
5. Add newly-surfaced tickets (create-then-wire); graduate any fog the answer has made specifiable, clearing each graduated patch from **Not yet specified** so it lives only as its new ticket. If the answer reveals a ticket — this one or another — sits beyond the destination, **rule it out of scope** rather than resolving it on the route. If the decision invalidates other parts of the map, update or delete those tickets.

The user may run unblocked tickets in parallel, so expect other sessions to be editing the map concurrently.
