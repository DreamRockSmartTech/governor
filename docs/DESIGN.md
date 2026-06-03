# Governor — Design of Record

> **Status:** design locked, pre-implementation (`0.0.1` stubs published). This document is the
> authoritative design for Governor's governance controls. It captures _decisions and their
> rationale_, not implementation. Sections marked **TBD** are deliberately deferred to
> implementation time.

## What Governor is

Portable, git-native governance for any repository. A project's governance is modeled as a **typed
node-graph** — charters, masterplans, epics, gates, decisions, work items — stored as plain markdown
files with YAML frontmatter. The graph degrades to plain `ls`/`cat`: no renderer or service
required.

- **Files are the sole source of truth.**
- **Git history is the authority** (the immutable record of who changed what).
- Reference instance: the `.governance/` tree in the H3G project, from which this design was
  derived.

### Packages

| Package                    | Role                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| `@dreamrock/governor-core` | Frontend-agnostic engine: parser, graph, validators, runner, authority. |
| `@dreamrock/governor-cli`  | Reference command-line frontend.                                        |
| `@dreamrock/governor`      | Flat umbrella package (re-exports core).                                |

A future VSCode extension is a sibling frontend over the same core.

---

## Foundational invariant

**Structure is CLI-mediated for everyone; prose is free-edit for everyone.**

- **AI agents:** may edit prose bodies and update field values _through the CLI_ — never write raw
  frontmatter, never create nodes.
- **Humans:** same structural constraint, nicer UX (interactive prompts now, GUI later). Prose is
  free to edit (within the freeze rules below).

Because the structural path is singular (the CLI), every guarantee below holds regardless of who is
driving. This is what makes the guarantees _trustworthy_ rather than _hopeful_.

A recurring design pattern across the controls: **rigid by default, with a friction-gated, on-record
escape hatch.** The tool has an opinion; a human can consciously override; the override is recorded.

---

## Authority & the approval record

`approved_by` / `owner` are a **record of an authorizing signal — not a permission**. Access control
is explicitly **out of scope**: if you can commit to the repo, you have authority to act. The
signature records _which_ authorized actor acted, not _whether_ they were allowed.

- **Init mandate:** git config must have `user.name`, `user.email`, `commit.gpgsign=true`,
  `gpg.program`, and `user.signingkey`. The tool **fails hard** if these are missing.
- `approved_by` is **derived/stamped from the verified commit signer** (mutate model — the typed-in
  value is not trusted).

### Three record stages (only stage 1 is built in v1)

The record can be written at three stages, each a different signal. **v1 recognizes exactly one.**

1. **Local — commit signature.** Author provenance. Works in a bare ssh repo, no extra infra. _All
   of v1._
2. **CI/CD.** The gate-proof runner running in a trusted pipeline (tests pass → gate clears). Same
   runner, different trust environment. Delegated sign-off (CI identity vs. human key) handled by an
   optional provenance trailer when the need concretely arises.
3. **Cloud host.** GitHub/GitLab/Bitbucket PR/MR merge approval (approver ≠ commit author), via
   API/webhook. Approver identity lives in the host API, not the commit.

**Boundary statement:** the `approved_by`/`owner` field shapes, the gate-`status` model, and the
optional provenance trailer are designed so additional signals (CI, cloud) can populate the _same_
records later **without schema or semantic change**. The tool degrades gracefully: absent CI/cloud,
the local signal is authoritative; present, they enrich the record. Multi-signal-ready, not
multi-signal-built.

---

## The six controls

### 1. Frozen mandates (immutability)

A node becomes **frozen the moment another node points a structural edge at it** — freeze is
_derived_ from the graph, not a declared flag. (Rationale: a declared flag can lag behind the first
inbound edge; a derived freeze cannot drift, and the lock point becomes a fact of the graph rather
than a matter of discipline.)

- **Total lock:** once frozen, both the prose body _and_ the frontmatter are immutable at HEAD.
- **Window:** free edits until the freezing commit lands.
- **Walk-back:** `git reset` is the only escape — and it is coherent precisely because it _rewrites
  history_, so the freeze and un-freeze are both accounted for. A reset re-opens the node **and its
  dependents together, as a set** (the same edges that propagated the freeze propagate the
  un-freeze).
- To change a frozen node's meaning, you **supersede** it with a new node — you do not edit it.

### 2. Gate-proof runner

A gate's `criteria_check` is a **structured frontmatter block**, not prose:

```yaml
criteria_check:
  runnable: path/to/check.sh # any mechanic (shell, ts, …); exit 0 = pass, 1 = fail
  description: "<prose: what this check probes>"
  expectation: "<prose: what a pass asserts>"
```

- The runner executes `runnable` and writes `status` from the exit code. `status` is
  **machine-owned**: `open` (never proven) · `cleared` (exit 0) · `failed` (ran, exit 1 — includes
  regressed-from-cleared). Bidirectional: a previously-cleared gate whose check now fails flips back
  to `failed`. `failed` is the "needs immediate work" bucket; `open` is "still pending."
- `partial: true|false` is a **separate, human-owned** boolean — a deliberate, commit-tracked
  **bypass** allowing a non-blocking ship over an unmet gate. Orthogonal to `status`: a gate can be
  `status: failed` _and_ `partial: true` (the check fails AND a human consciously accepted
  shipping).

### 3. Schema / grammar validation

**One validation core, two entry points:** the CLI calls it before every write (prevent); it also
runs standalone (catch anything that bypassed the CLI).

- **ID:** `{node_type}-{NN}-{slug}` plus an immutable `uid` (UUID). The validator checks the prefix
  agrees with `node_type` and `{NN}` is unique. `{NN}` is a **monotonic high-water counter** per
  node-type — the CLI allocates `max+1`, never reuses or gap-fills (so deletions leave permanent
  holes, by design). High-water allocation requires a **persisted counter file** (a directory scan
  is insufficient: deleting the highest node would wrongly free its number).
- **Enums:** the tool ships sensible defaults; a repo may provide an **optional taxonomy-override
  map** to redefine enum sets per node-type (portability — teams need their own vocab). Merge/extend
  when present; whether an override may _narrow/remove_ a default state is **TBD at implementation**
  (couples to CLI logic).
- **Ordering:** frontmatter ordering (scalars first, lists last) is **auto-normalized** on CLI write
  (cosmetic, like `deno fmt`); the standalone checker may flag drift but never hard-blocks on it.

### 4. Graph integrity (symmetry + blast radius)

- **Symmetry:** structural edges are bidirectional (`parent`↔`children`, `blocks`↔`blocked_by`,
  `supersedes`↔`superseded_by`). The CLI **maintains both sides** on write (declare one, it writes
  the reverse); the standalone checker catches hand-edit drift. (Weak `cites` is one-way; reverse
  computed.)
- **Blast radius** is a **derived in-memory traversal**, not a stored edge — "if I touch X, what's
  downstream." Its behavior depends on _what kind_ of change it is:
  - **Prose/content change** → **advisory**: report what's downstream, do not block.
  - **Structural change** (an edge added/removed/retargeted, or a `criteria_check` change) →
    **blocking** → route to supersession. (Such a change _modifies_ relationships dependents rely
    on.)
  - The tool therefore distinguishes a **structural diff** (frontmatter edges + `criteria_check`)
    from a **prose diff** (body text).
- **No persisted graph structure.** At hundreds–low-thousands of nodes, building the graph in-memory
  from frontmatter per run is single-digit milliseconds. An **optional ESLint-style ephemeral
  cache** (mtime/hash-keyed) may speed repeat runs — it is a pure cache: deletable, rebuildable,
  zero authority. A stale cache yields a miss, never a wrong answer.

### 5. Creation & navigation tooling

Two command families:

- **`new`** — the only path that creates and initializes a node: allocate `{NN}`, generate `uid`,
  write valid (ordered) frontmatter, **wire the bidirectional edge**, and **regenerate INDEX**.
  CLI-only. Flag-driven (`governor new epic --parent … --title …`) _and_ interactive (prompts for
  missing fields).
- **`set` / `edge` / `status`** — controlled field/edge mutation. This is the **AI-safe path** for
  changing values (changing a structural field value is the blocking case from control 4, so it must
  go through the CLI, not a raw frontmatter edit).

**Out-of-band structural frontmatter change is a HARD FAIL** (not a warning). Whoever did it — AI or
human — must resolve it directly. This is the keystone that makes controls 1–4 trustworthy: the only
valid way to mutate structure is the path that maintains the invariants. INDEX is a CLI-regenerated
view, never hand-maintained.

### 6. Review-boundary check

One **WorkItem per commit-group** keeps review small and focused, and keeps git-history-as-record
mapping cleanly one-change-to-one-commit.

- "commit-group" defaults to a **single focused commit**; the unit is **team-configurable** later
  (git-flow strategy varies — some teams review per-PR). Heuristic for now.
- More than one WorkItem in a commit-group → **warn, permitted with an override**: a commit-message
  **trailer** (`Governor-Allow-Multi: <reason>`). Non-interactive, scriptable, and on the git record
  — consistent with the gate `partial` bypass pattern.

---

## Out of scope (v1)

- **Concurrency / multi-user `{NN}` counter collisions.** The team owns coordination (or a git
  conflict-resolution policy); the toolkit does not own this yet.
- **CI/CD and cloud-host record integrations** (stages 2 & 3 above) — seams preserved, not built.
- **ACL / permissions** — repo access _is_ authority by design.

## Data structures (total)

1. **Markdown files** (frontmatter + body) — the source of truth.
2. **In-memory graph** built per run, plus an **optional ephemeral cache** (speed only).
3. **Persisted high-water counter file** — one line per node-type with its current max `{NN}`.
