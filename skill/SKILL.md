---
name: governor
description: >
  Governance-driven coding workflow for repositories managed by Governor (a
  .governance/ directory of typed markdown nodes enforced by git hooks). Use
  this skill whenever a repository contains a .governance/ directory, when the
  user mentions Governor, workitems, gates, governance nodes, or "one workitem
  per commit", when a commit is rejected by a governor hook, or at the start of
  any coding workstream in a governed repository. The skill covers the full
  loop: synchronizing with the user on scope through an adversarial design
  interview, mapping the agreed work onto governance nodes via the governor
  CLI, using free-form prose for session tracking, and finishing work through
  gates so every commit stays reviewable.
---

# Governor — governance-driven coding workstreams

Governor models a project's governance as a **typed node-graph** — projects, masterplans, epics,
workitems, gates, decisions — stored as plain markdown files with YAML frontmatter under
`.governance/`, validated and enforced by git hooks. Files are the sole source of truth; git history
is the authority.

Two rules carry everything (the foundational invariant):

1. **Structure is CLI-mediated for everyone.** Never write or edit YAML frontmatter by hand (one
   exception: a fresh gate's `criteria_check`, see [references/cli.md](references/cli.md)). Never
   create a node file by hand. Every structural action goes through `governor` commands. The
   pre-commit hook compares the staged snapshot against HEAD and **rejects** anything the CLI could
   not have produced.
2. **Prose is free-edit for everyone** — on unfrozen nodes. The markdown body below the frontmatter
   is yours to write: descriptions, evidence, session notes. A **frozen** node (one other nodes rely
   on — a parent with children, a blocker, anything superseded) cannot change in meaning at all; to
   change it, supersede it.

## References — read before acting

| When                                                         | Read                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Starting Phase 1 (any non-trivial scope)                     | [references/interview.md](references/interview.md) — the full interview method                |
| Creating nodes, authoring gates, committing                  | [references/cli.md](references/cli.md) — commands, recipes, sharp edges                       |
| Touching anything under `.governance/`, unsure what is yours | [references/structure.md](references/structure.md) — layout, ownership zones, the drift fence |

## Phase 1 — Synchronize before you code (the interview)

Do not start coding from a one-line request. Run the adversarial design interview
([references/interview.md](references/interview.md)) until you and the user share one model of the
work. In brief: ingest the tree first (`governor next`, `governor work <id>`, node prose); present
the decision branches; descend one branch at a time, **one question per turn**, hunting unstated
dependencies; checkpoint every few questions; close with a summary and the node plan.

**Hard gate: do not write code until the user confirms the decomposition** — which
epics/workitems/gates you will create, with their `--parent` / `--blocks` / `produces_gate` wiring,
one reviewable unit per workitem. Anything still open becomes a `blocked_by` edge or a deferred
workitem, never a silent assumption.

## Phase 2 — Encode the agreed work as nodes

Create structure only through the CLI (it allocates ids, stamps `owner`, wires both sides of every
edge, regenerates the INDEX). Full recipes in [references/cli.md](references/cli.md).

```sh
governor new epic     --title "<mandate>"  --parent masterplan-01-…
governor new workitem --title "<one reviewable unit>" --parent epic-NN-…
governor new gate     --title "<proof of done>"   # author criteria_check NOW — see cli.md
governor edge add <workitem-id> produces_gate <gate-id>
governor edge add <workitem-B> blocked_by <workitem-A>   # B waits on A
```

When to create what: **workitem** = the unit of work and review (one workitem ↔ one commit; two
commits = two workitems). **epic** = a cluster of 3+ related workitems under one mandate. **gate** =
a machine-runnable proof whenever "done" is checkable — script in `.governance/checks/`, exit 0 =
cleared. **decision** = a ruling that reverses or constrains earlier design, linked via
`decisions`/`cites` (weak edges, legal even on frozen nodes).

**Write the prose body at creation** — `## Description` / `## Evidence` / `## Approach` go in the
moment the node exists, before the commit that lands it. A bare frontmatter-only node defeats the
review boundary.

## Phase 3 — Track the session in prose

The workitem's body is the living record the human reviews (free-edit; frontmatter stays untouched):
`## Description` (what, for the reviewer), `## Evidence` (why — the failing test, the finding, the
ruling), `## Approach` (decisions taken, rejected alternatives), `## Session log` (dated notes when
work spans sessions). Update as you go, not retroactively. If a node you need to annotate is frozen,
put the notes on the dependent workitem, or supersede.

## Phase 4 — Finish through the gate, commit inside the boundary

- `governor done <id>` — runs the produced gate; completes the node only when it clears. A failing
  gate keeps the node open: **fix the work, not the gate.**
- The pre-commit hook **re-runs every gate proof on every commit** and blocks on any failed gate
  unless that gate carries the human-owned `partial: true` bypass — a decision that belongs to the
  user, lands in a signed commit, and is git-blame auditable. Never set it on your own judgment.
- **One workitem per commit**: stage the workitem node (its creation or its `done` flip) together
  with the code it covers. The commit-msg hook counts staged workitem files — 0 or >1 blocks — and
  stamps the evidence-derived `Governor-WorkItem: <id>` trailer.
- Genuinely multi- or zero-workitem commits need `Governor-Allow-Multi: <reason>` in the message —
  deliberate, rare, on record.
- A churn warning ("staged diff is N lines for a single WorkItem") never blocks — it asks you to
  confirm the unit is honestly one reviewable change. If it is not, split it.

## When the hooks push back

| Rejection                                 | Meaning                                                         | Right response                                                              |
| ----------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `frozen-node-edited` / `frozen-body-edit` | You changed a node others rely on                               | Revert; `governor new … --supersedes <id>` and edit the successor           |
| `out-of-band-structural`                  | A structural change the CLI would have refused was made by hand | Revert the hand edit; use `governor edge` / `set` / `status`                |
| `asymmetric-edge`                         | One-sided edge drift                                            | `governor edge add <from> <kind> <to>` (reconciliation is always permitted) |
| gate `FAILED with no partial bypass`      | A gate proof fails at commit time                               | Fix the work so the proof passes; only the user may decide `partial: true`  |
| `no-workitem` / `multi-workitem`          | Commit not shaped as one reviewable unit                        | Split the commit, or justify with `Governor-Allow-Multi: <reason>`          |
| `legacy-criteria-check` (warning)         | Gate has prose criteria; `gate run` would fail closed           | Migrate to a structured `criteria_check` with a `runnable`                  |

`GOVERNOR=0 git commit …` bypasses all hooks. Never use it silently; if you must, say so to the user
first and record why as a trailer in the commit message — the bypass itself must be signed and
auditable.

## What Governor will not do (and you must)

Governor enforces evidence-grounded proxies; it cannot certify that work was honestly decomposed or
that prose tells the truth — that is the human reviewer's job, and this workflow exists to keep
their review small, framed, and unavoidable. Your part of that contract: decompose honestly in Phase
1, keep one workitem per commit in Phase 4, and write prose a reviewer can trust.
