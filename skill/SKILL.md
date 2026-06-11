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

1. **Structure is CLI-mediated for everyone.** Never write or edit YAML frontmatter by hand. Never
   create a node file by hand. Every structural action goes through `governor` commands. The
   pre-commit hook compares the staged snapshot against HEAD and **rejects** anything the CLI could
   not have produced.
2. **Prose is free-edit for everyone** — on unfrozen nodes. The markdown body below the frontmatter
   is yours to write: descriptions, evidence, session notes. A **frozen** node (one other nodes rely
   on — a parent with children, a blocker, anything superseded) cannot change in meaning at all; to
   change it, supersede it.

## Phase 1 — Synchronize before you code (the interview)

Do not start coding from a one-line request. First reach shared understanding with the user, then
encode it as nodes. Run a scoped adversarial design interview (the grill-me method):

1. **Ingest.** Read the governance tree before asking anything: `governor next` (what is unblocked),
   `governor work <id>` (status, blockers, downstream, gate) on candidates, and the prose bodies of
   the nodes involved. Demonstrate you have read them — never ask what a node already answers.
2. **Present the branches.** State your read of the work as the decision tree you see: the major
   decision clusters, the dependencies between them, and the workitem decomposition you propose (one
   reviewable unit per workitem — each will become exactly one commit). Ask which branch to start
   with.
3. **Descend one branch at a time, one question per turn.** Probe constraints, failure modes,
   trade-offs, and above all **dependencies the user has not acknowledged** ("this assumes X is
   decided — is it?"). Concrete beats abstract; never batch questions; "I don't know" is a finding
   to log, not a gap to fill unsolicited.
4. **Checkpoint** every few questions: what is resolved, what is open, which dependencies surfaced.
   Keep the user oriented in the tree.
5. **Close with a summary** — decisions locked, open items, risks — and the final node plan: which
   epics/workitems/gates you will create, with their `--parent` / `--blocks` wiring.

**Gate: do not write code until the user confirms the decomposition.** The confirmed summary is what
you encode into nodes; anything still open becomes a `blocked_by` edge or an explicitly deferred
workitem, not a silent assumption.

## Phase 2 — Encode the agreed work as nodes

Create structure only through the CLI (it allocates ids, stamps `owner`, wires both sides of every
edge, and regenerates the INDEX):

```sh
governor new epic     --title "<mandate>"  --parent masterplan-01-…
governor new workitem --title "<one reviewable unit>" --parent epic-NN-…
governor new gate     --title "<proof of done>"       # bind via edge below
governor edge add <workitem-id> produces_gate <gate-id>
governor edge add <workitem-B> blocked_by <workitem-A>   # B waits on A
governor set <id> <field> <value>     # plain scalars only
governor status <id> <new-status>     # work/plan status transitions
```

When to create what:

- **workitem** — the unit of work and of review: one workitem ↔ one commit. If a task needs two
  commits, it is two workitems.
- **epic** — a cluster of workitems under one mandate; create it when the interview surfaces 3+
  related workitems.
- **gate** — a machine-runnable proof (`criteria_check.runnable`, exit 0 = cleared). Create one
  whenever "done" is checkable; `governor done` will run it and refuse to complete the node on
  failure.
- **decision** — a ruling that reverses or constrains earlier design; link it from affected nodes
  with `cites`/`decisions`.

## Phase 3 — Track the session in prose

While working, keep the living record in the workitem's **body** (free-edit; the frontmatter stays
untouched). Use these sections — they are what the human reviews:

- `## Description` — what this unit is, written for the reviewer.
- `## Evidence` — why it exists: the failing test, the finding, the user ruling that motivated it.
- `## Approach` — decisions taken while implementing, including rejected alternatives and the
  reason.
- `## Session log` — short dated notes when work spans sessions; what changed, what is still open.

Update prose as you go, not retroactively. If a node you need to annotate is frozen, its meaning is
locked: put the notes on the dependent workitem, or supersede.

## Phase 4 — Finish through the gate, commit inside the boundary

- `governor done <id>` — runs the node's produced gate; completes the node only when the gate clears
  (or there is none); regenerates the INDEX. A failing gate keeps the node open — fix the work, not
  the gate.
- **One workitem per commit**: stage the workitem node (its creation or its `done` flip) together
  with the code it covers. The commit-msg hook counts staged workitem files — 0 or >1 blocks the
  commit — and stamps the evidence-derived `Governor-WorkItem: <id>` binding trailer on a clean
  pass.
- A genuinely multi-workitem or zero-workitem commit (bootstrap, docs-only, tree-wide sweep) needs a
  deliberate, on-record override trailer in the commit message: `Governor-Allow-Multi: <reason>`.
  Use it consciously and rarely; the reason lands in git history.
- A churn warning ("staged diff is N lines for a single WorkItem") never blocks — it asks you to
  confirm the unit is honestly one reviewable change. If it is not, split it.

## When the hooks push back

| Rejection                                 | Meaning                                                         | Right response                                                              |
| ----------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `frozen-node-edited` / `frozen-body-edit` | You changed a node others rely on                               | Revert; `governor new … --supersedes <id>` and edit the successor           |
| `out-of-band-structural`                  | A structural change the CLI would have refused was made by hand | Revert the hand edit; use `governor edge` / `set` / `status`                |
| `asymmetric-edge`                         | One-sided edge drift                                            | `governor edge add <from> <kind> <to>` (reconciliation is always permitted) |
| `no-workitem` / `multi-workitem`          | Commit not shaped as one reviewable unit                        | Split the commit, or justify with `Governor-Allow-Multi: <reason>`          |
| `legacy-criteria-check` (warning)         | Gate has prose criteria; `gate run` would fail closed           | Migrate to a structured `criteria_check` with a `runnable`                  |

`GOVERNOR=0 git commit …` bypasses all hooks. Never use it silently; if you must, say so to the user
and record why in the commit message.

## What Governor will not do (and you must)

Governor enforces evidence-grounded proxies; it cannot certify that work was honestly decomposed or
that prose tells the truth — that is the human reviewer's job, and this workflow exists to keep
their review small, framed, and unavoidable. Your part of that contract: decompose honestly in Phase
1, keep one workitem per commit in Phase 4, and write prose a reviewer can trust.
