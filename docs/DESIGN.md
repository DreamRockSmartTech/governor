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

Authority is a **record, not a permission**. Access control is **out of scope**: if you can commit
to the repo, you have authority to act. Two distinct concerns, deliberately split (see
[ADR-0001](decisions/ADR-0001-approval-authority-scope.md)):

- **`owner` — stewardship, Governor-managed.** Every node carries `owner` = the committing user's
  git-config identity (`user.email`), **auto-stamped at creation**. It records _who is responsible
  for_ the node, not _who approved_ it. A convenience record; git history is the real authority.
- **`approved_by` — approval, OUT OF SCOPE for Governor.** Approval is a human sign-off that only a
  `decision` node meaningfully needs, and the one place it belongs — a _verified_ approver recorded
  at merge — **cannot be done git-natively across both bare-repo and cloud-host worlds without
  monkey-patching** (local git can't verify-and-record in one commit; cloud approval lives in the
  platform, not a signing key). So **approval authority is owned by the host's review system**
  (required reviewers + branch protection on a cloud host; the team's process on a bare repo).
  Governor neither stamps nor enforces it. This is a documented **stage-3 seam** (below), not a
  built feature. An `approved_by` value in a consuming tree is tolerated but not managed.

- **Init mandate:** `governor init` (see _Distribution & git-hook integration_) requires git config
  to have `user.name`, `user.email`, `commit.gpgsign=true`, `gpg.program`, and `user.signingkey`. It
  **fails hard** if these are missing — signing is the trust root.

### Three record stages (only stage 1 is built in v1)

The record can be written at three stages, each a different signal. **v1 recognizes exactly one.**

1. **Local — commit signature.** Author provenance. Works in a bare ssh repo, no extra infra. _All
   of v1._
2. **CI/CD.** The gate-proof runner running in a trusted pipeline (tests pass → gate clears). Same
   runner, different trust environment. Delegated sign-off (CI identity vs. human key) handled by an
   optional provenance trailer when the need concretely arises.
3. **Cloud host.** GitHub/GitLab/Bitbucket PR/MR merge approval (approver ≠ commit author), via
   API/webhook. Approver identity lives in the host API, not the commit.

**Boundary statement:** v1 records exactly the **local** signals Governor manages — `owner`
(committer identity) and the machine-owned gate `status`. **Approval** at stages 2 and 3 (CI
sign-off, cloud PR/MR merge approval) is **owned by the host**, not stamped into the tree by
Governor (ADR-0001). The `owner` field shape and the gate-`status` model are stable, so a host
integration could later attach its own approval record alongside them **without schema change** —
but that integration is the host's, not Governor's. Multi-signal-aware, not multi-signal-built.

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

## Distribution & git-hook integration (Husky-shaped)

Governor is a **portable, drop-in governance dependency**: a consuming repo installs it and gets the
controls above wired into the git lifecycle automatically. The integration is **modeled on Husky** —
its engine/policy split is exactly the split Governor needs (the package ships the _mechanism_; the
repo ships the _policy_).

### `governor init` — the installer

`governor init` is the single setup entry point. It:

1. **Asserts the git-config signing mandate** (the "Authority" section above): `user.name`,
   `user.email`, `commit.gpgsign=true`, `gpg.program`, `user.signingkey`. **Fails hard** if any is
   missing — signing is the trust root, so an unsigned repo is not a valid Governor install.
2. **Redirects git's hook path** to Governor's own — `git config core.hooksPath .governance/hooks`.
   This is Husky's core trick: no symlinks, no clobbering `.git/hooks/`, fully version-controllable,
   reversible (`git config --unset core.hooksPath`).
3. **Lays down the two-tier hook layout** (below) and seeds **sensible default hooks**.

### Two-tier hook layout (Husky's engine/policy split)

```
.governance/hooks/
  _/                 # ENGINE — generated, .gitignored, never hand-edited
    governor.sh        #   the wrapper: bypass check, dispatch, fail-on-error
    pre-commit         #   one tiny stub per git hook → sources the wrapper
    commit-msg         #   "
    …
  pre-commit         # POLICY — committed, repo-owned, end-user editable
  commit-msg         # "
```

- **`_/` (engine)** is regenerated by `governor init`/`governor` upgrades and is **gitignored** —
  like Husky's `.husky/_`. The git hook git actually invokes is the stub in `_/`; it sources the
  wrapper.
- **The repo-level hook files (policy)** are **committed and meant to be edited** by the consuming
  team. They are where a repo adds its own checks/extension scripts. Each shipped default simply
  calls the relevant `governor` subcommand, so the common case needs no editing; teams override or
  extend by changing these files.

### Shipped default hooks (sensible defaults, all overridable)

| Hook         | Default action                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pre-commit` | `governor check` on the staged tree → **reject the commit on any error**. This is the enforcement teeth that makes "out-of-band structural change is a HARD FAIL" (control 5) real rather than opt-in. |
| `commit-msg` | Review-boundary check (control 6) + the `Governor-Allow-Multi` trailer override. (Approval stamping is **out of scope** — see ADR-0001.)                                                               |

A consuming repo may **edit, replace, or remove** any policy hook, and **add** scripts for other git
lifecycle events (`pre-push`, `post-merge`, …) — the wrapper runs whatever policy file exists for a
given hook. **Bypass** follows the Husky pattern: a `GOVERNOR=0` env var (and git's native
`--no-verify`) skips the hooks — the rigid-default / conscious-on-record-override pattern again.

### Engine/policy as the trust split

The package shipping the engine and the repo owning the policy is the same boundary as Husky's
"Husky runs your scripts, ships no opinion about them" — but Governor's engine carries the
governance _opinion_ (the controls), while the repo's policy layer carries repo-specific extension.
The one place this split gets genuinely hard — **who guards the authority policy itself** (the
fingerprint→role map / protected-node list a repo would own) — is the recursion knot deferred to the
authority work (it is **out of scope** for the hook-mechanism slice; the hooks ship the _mechanism_,
the authority-manifest _policy_ comes later).

---

## Out of scope (v1)

- **Concurrency / multi-user `{NN}` counter collisions.** The team owns coordination (or a git
  conflict-resolution policy); the toolkit does not own this yet.
- **CI/CD and cloud-host record integrations** (stages 2 & 3 above) — seams preserved, not built.
- **ACL / permissions** — repo access _is_ authority by design.

## Data structures (total)

1. **Markdown files** (frontmatter + body) — the source of truth.
2. **In-memory graph** built per run, plus an **optional ephemeral cache** (speed only).
3. **Persisted high-water counter file** — `.governance/counters.json`, a `{ node_type: max-NN }`
   map (committed; authority-bearing).
4. **Git-hook engine + policy layout** — `.governance/hooks/_/` (generated, gitignored) and the
   committed repo-owned policy hooks (see _Distribution & git-hook integration_).
