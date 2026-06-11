# Changes

All notable changes to Governor are recorded here. Versions follow
[Semantic Versioning 2.0.0](https://semver.org/).

## 0.1.1 — 2026-06-11

Dogfood completion and the skill's full directory format.

### Added

- **Skill directory format**: `@dreamrock/governor-skill` now ships `SKILL.md` (lean core with a
  when-to-read table) plus `references/` — `interview.md` (the complete adversarial design-interview
  methodology, governance-grounded), `cli.md` (command recipes including the sanctioned fresh-window
  `criteria_check` hand-edit and the `partial: true` audit trail), and `structure.md` (the
  `.governance/` layout, ownership zones, and drift fence). `installSkill` installs the whole
  directory from a `SKILL_FILES` manifest with per-file idempotency.
- **Runnable gates in Governor's own tree**: gate-01 (CLI e2e suite) and gate-02 (publish dry-run),
  proofs committed under `.governance/checks/`, produced by workitems 10/12. The repo's pre-commit
  policy hook re-runs every gate proof on each commit and blocks on a failed gate unless the
  human-owned `partial: true` bypass is on record in the gate file (git-blame auditable via the
  signed commit that flips it).
- **Decision nodes**: ADR-0001/0002 are now `decision` nodes in the self-governance tree, linked via
  weak `decisions`/`cites` edges (the docs/ originals remain).

### Fixed

- Weak (non-structural, non-freezing) edge kinds — `decisions`, `cites` — are exempt from the freeze
  guard on `governor edge add`, and `stagedBoundary` mirrors the exemption: annotation links can be
  added to frozen nodes without supersession.
- `deno fmt`/`deno lint` exclude `.governance/` and `docs/` (governance prose is owned by the CLI
  and hooks, not the formatter; CI was failing on it).

## 0.1.0 — 2026-06-11

The first real release: the six controls, the plumbing + porcelain command layers, git-hook
enforcement (including the staged-snapshot out-of-band boundary), the repo taxonomy seam, and the
agent skill — dogfooded on this repository and on the H3G reference tree. Pre-1.0 per SemVer: the
public API may change between minor versions. POSIX platforms only.

### Added — Phase D hardening + release engineering

- **CLI integration suite** (`cli/tests/cli.e2e.ts`): drives the command runners against real temp
  git repositories — `init` mandate/idempotency/no-clobber, the `new`→`set`→`done` lifecycle with
  counters and freeze, the gate runner (bidirectional status), `done` refusing on a failing gate,
  `check --staged` boundary behavior, `review-check` binding/blocking, and the installed hooks
  end-to-end through actual `git commit` (including the `GOVERNOR=0` bypass).
- **CI** (`.github/workflows/ci.yml`): fmt/lint/type-check/tests + `governor check` on this repo's
  own governance tree + a JSR publish dry-run, on every push/PR. **Publish workflow**
  (`.github/workflows/publish.yml`): publishes all packages to JSR via GitHub OIDC on a `v*` tag.
- `gate run` surfaces the human-owned `partial` bypass on a failed gate (control 2's escape hatch is
  now visible to the operator, not just to readers of the frontmatter).
- `governor edge` rejects an unknown op instead of silently treating it as `add`; shared
  `asList`/`statusOf`/`DONE_STATUSES` helpers replace five private copies; published packages
  exclude their test directories.

### Added — `governor check --staged`: out-of-band enforcement (controls 1 & 5)

The pre-commit teeth the design promised. `check --staged` materializes the **staged snapshot** and
HEAD from git blobs (the working tree plays no part), runs the full validator over the staged tree,
and judges the delta with boundary rules that mirror the CLI's own legality — anything the CLI could
have produced passes, anything it would have refused blocks:

- Edits to a **frozen** node — body, plain fields, deletion — block (`frozen-body-edit`,
  `frozen-node-edited`, `frozen-node-deleted`); `status` stays workflow-exempt (ADR-0002).
- **Symmetric hand-made structural changes** — both sides edited consistently, invisible to a
  snapshot-only check — block (`out-of-band-structural`) unless at least one direction of
  `governor edge add|rm` could have performed them (freeze + dependents judged at HEAD, counterparty
  excluded). Reconciliation backfills and new-node wiring are always recognized as legal.
- A `criteria_check` change on a gate that is frozen or has dependents blocks.

Core: `stagedBoundary` (pure; graphs in, findings out), `nodeFromSource`, `parseTaxonomyOverride`,
git plumbing `lsTree`/`lsStaged`/`showFile`. The seeded default `pre-commit` policy hook now runs
`governor check --staged`.

### Added — legacy `criteria_check` warning

`validate` warns (`legacy-criteria-check`, never blocks) when a gate's `criteria_check` is not the
structured `{runnable, …}` block — migrating hand-authored trees see that `gate run` would fail
closed instead of being surprised by it.

### Added — `@dreamrock/governor-skill`: the agent skill package

The cooperative layer of control 6's defense-in-depth, as an installable package. `SKILL.md` teaches
a coding agent the governed workflow: a grill-me-style adversarial design interview to synchronize
with the user before coding (one question at a time, dependencies are the prize, checkpoint
summaries, and a hard gate — no code until the user confirms the workitem decomposition); when and
how to create nodes through the CLI; the free-edit prose sections used for review and tracking
(`## Description` / `## Evidence` / `## Approach` / `## Session log`); and how to respond when the
hooks push back. Install: `deno run -A jsr:@dreamrock/governor-skill/install` (default dest
`.claude/skills/governor/`, idempotent, upgrades stale copies).

### Changed — freeze protects the depended-upon node; status is workflow-exempt (ADR-0002)

A design correction (see [docs/decisions/ADR-0002](docs/decisions/ADR-0002-freeze-direction.md)),
surfaced by dogfooding: the slice-2 freeze direction froze the **dependent** (a workitem created
with `--parent` was frozen at birth), making `set`/`status`/`done` impossible on essentially every
node of a real tree.

- **Freeze direction flipped:** the freezing kinds are the reliance-declaring inbound edges —
  `parent` (children derive from this node), `blocked_by` (something waits on it), `supersedes`
  (superseded historical record). The dependent stays editable.
- **`status` transitions are exempt from the freeze guard** — freeze locks _meaning_ (title, prose,
  plain fields, edges); status is workflow state, still enum-validated. A frozen epic is completable
  when its children are done.
- **Counterparty exclusion:** removing edge `A —kind→ B` ignores freeze on `A` contributed by `B` —
  a relationship's own reliance cannot block its dissolution. Bystander freeze still blocks.

### Added — taxonomy seam: repo override + taxonomy-derived freeze/blast-radius

Control 3's portability seam, now real end-to-end:

- **`.governance/taxonomy.json`** — optional repo override merged onto the shipped defaults
  (extend-only): node types, per-type status enums, edge kinds, id-prefix aliases. Loaded by the new
  core `loadTaxonomy(root)`; the CLI resolves it once per invocation (`loadTree`) and every command
  consumes it — repo-defined vocabulary applies uniformly to validation, symmetry, freeze, and blast
  radius. A malformed override is an error, never a silent fallback.
- **`EdgeKind` gains `freezes` and `toDependent`** — freeze and blast-radius direction are now
  declared per edge kind in the taxonomy instead of two hard-coded kind lists, so repo-defined
  structural kinds participate fully.
- **Default vocabulary extended with the reference tree's gate bindings:** `produces_gate` ↔
  `guarded_by` (structural, symmetric; `guarded_by` freezes the producing node, the gate itself
  stays unfrozen so its human-owned `partial` bypass remains settable), plus `consumes_gate`,
  `decisions`, `cited_by`, and `gates` as recognized weak one-way references (dangling targets are
  now caught).

### Fixed

- **Unquoted YAML dates round-trip byte-stable.** The default YAML schema parsed
  `created_at:
  2026-05-22` into a Date object, which re-serialized as `2026-05-22T00:00:00.000Z` —
  corrupting every node a write command touched. Parser and serializer now use the `core` schema;
  plain dates stay plain strings. (Note: YAML _comments_ inside frontmatter are still dropped on
  rewrite — the frontmatter is CLI-owned by design; keep commentary in the prose body.)

### Dogfood

- Governor now governs itself: a `.governance/` tree (project, masterplan, this slice's workitems)
  with hooks installed via `governor init`. The seeded policy hooks were edited to run Governor from
  source — exactly the repo-owned policy customization the Husky-shaped design intends.
- The H3G reference tree was healed with `governor edge add` (13 symmetry reconciliations — the 12
  known drifts plus a one-sided `produces_gate` binding the extended vocabulary surfaced) and
  validates clean: 82 nodes, 0 errors.

### Added — porcelain workflow verbs (`next` / `work` / `done`)

Task-shaped commands that compose the plumbing (à la git porcelain) for the pick → orient → finish
loop. **No new core logic** — pure CLI orchestration over existing core functions.

- `governor next` — list **open, unblocked** WorkItems (every `blocked_by` target is done, or none).
  "What can I work on now?"
- `governor work <id>` — read-only orientation view: status, frozen?, each blocker's done-state,
  what it blocks, its produced gate, a body excerpt. (No status change — the work/plan enum has no
  `in_progress` state and Governor does not invent one.)
- `governor done <id>` — finish a node: run its `produces_gate` (the proof-of-done); complete the
  node only if the gate clears (or there is no gate); regenerate the INDEX. A failing gate leaves
  the node open and exits 1.

### Fixed

- **Gate runner resolves `criteria_check.runnable` against the repo root** (parent of
  `.governance/`), with the repo root as cwd — a gate's proof tests the project, which lives at the
  repo root, not inside the governance tree. Previously it resolved against the `.governance/` dir.
  Surfaced by the porcelain `done` E2E.

### Added — review-boundary check (control 6)

The last governance control: one staged WorkItem node per commit, protecting reviewability against
runaway batches. Enforces evidence-grounded proxies and surfaces signals; honest work decomposition
remains delegated to human review (it cannot be certified in-repo — see DESIGN.md control 6).

- `governor review-check <msg-file>` (hook-invoked at `commit-msg`): counts distinct staged
  `workitem-*` nodes. **0** (code with no work-node) or **>1** → **blocks** the commit, unless a
  non-empty `Governor-Allow-Multi: <reason>` trailer overrides (on the git record). On a clean
  single-node commit it stamps an evidence-derived `Governor-WorkItem: <id>` binding trailer (from
  the staged node, not actor free-text). Staged diff churn above `governor.churnThreshold` (default
  400) → an advisory `scope-vs-churn` **warning** (never blocks).
- Core: `review-boundary.ts` (pure rules + `parseTrailer`/`appendTrailer`); `git.ts` gains
  `stagedFiles` / `stagedChurn`.
- The default `commit-msg` hook now calls `governor review-check "$1"`.

Verified end-to-end: single-node commit passes + gets the trailer; multi-node and no-node commits
block (override works); oversized single-node diff warns but commits.

### Changed — approval authority scoped out; `owner` auto-stamped (ADR-0001)

A design correction (see
[docs/decisions/ADR-0001](docs/decisions/ADR-0001-approval-authority-scope.md)).

- **`approved_by` is out of Governor's scope.** It is not stamped, derived, or enforced. The one
  place a _verified_ approver belongs — recorded at merge — cannot be done git-natively across both
  bare-repo and cloud-host worlds without monkey-patching (local git can't verify-and-record in one
  commit; cloud approval lives in the platform API, not a signing key). Approval authority is
  **owned by the host's review system** (required reviewers + branch protection), a documented
  stage-3 seam. An `approved_by` value in a consuming tree is tolerated but not managed.
- **`owner` is auto-stamped from the committer.** `governor new` sets `owner` = the committer's git
  `user.email` (stewardship, not approval). `createNode` takes an optional `owner` in its spec;
  omitted when git config has no email.
- DESIGN.md updated to reverse the prior "derive `approved_by` from the verified signer" wording.

### Added — git-hook integration (Husky-shaped) + `governor init`

Wire the controls into the git lifecycle so enforcement is automatic, not opt-in.

- `governor init` — the installer. Asserts the git-config signing mandate (`user.name`,
  `user.email`, `commit.gpgsign=true`, `gpg.program`, `user.signingkey`) and **fails hard** if any
  is missing; sets `core.hooksPath` to Governor's hook dir; lays down the two-tier layout and seeds
  default hooks. Idempotent; never clobbers an edited policy hook.
- **Two-tier layout** (engine/policy split, à la Husky): `.governance/hooks/_/` is generated and
  **gitignored** (the `governor.sh` wrapper + a per-hook stub git actually runs);
  `.governance/hooks/<name>` are committed, repo-owned, editable policy hooks.
- **Shipped defaults:** `pre-commit` → `governor check` (rejects a commit when the governance tree
  is invalid — the enforcement teeth for the control-5 keystone); `commit-msg` → placeholder for the
  review-boundary check (control 6, later).
- **Bypass:** `GOVERNOR=0` (and git's `--no-verify`) skips the hooks — rigid default, conscious
  on-record override.
- Core gains `core/src/hooks.ts` (pure layout/content + `missingSigningKeys`) and `core/src/git.ts`
  (git-config read/write wrappers).

Verified end-to-end on a scratch repo: `init` fails hard without signing config; with it, the hooks
install and `pre-commit` blocks an invalid tree, allows a valid one, and `GOVERNOR=0` bypasses.

### Added — write path (plumbing) + gate-proof runner

The mutation surface: the only valid way to change a `.governance/` tree, with every invariant
enforced. Modeled on git's plumbing/porcelain split — these are the precise, graph-aware primitives;
task-shaped porcelain comes later.

**`@dreamrock/governor-core`**

- `serializeNode(frontmatter, body)` — inverse of `splitFrontmatter`; ordered frontmatter (scalars
  first, lists last), round-trips with the parser.
- `freezeState` / `isFrozen` / `guardMutation` — frozen-mandate detection (a node is frozen by an
  inbound _freezing_ structural edge — `children`/`blocks`/`supersedes`) and enforcement. Detect and
  enforce are separate so a GUI can render a lock icon (detect) or block on submit (enforce).
- `allocate` / `loadCounters` / `writeCounters` — persisted monotonic high-water `{NN}` in
  `.governance/counters.json`, auto-bootstrapped from the live tree max on first use; atomic writes.
- `createNode` / `setField` / `addEdge` / `removeEdge` / `transitionStatus` (+ `MutationError`) —
  pure mutation helpers returning the nodes to persist. Enforce freeze, write-time validation (only
  _introduced_ errors block — pre-existing drift is tolerated so it can be fixed), edge symmetry
  (both sides), and blocking blast-radius (a structural change on a node with dependents routes to
  supersession). **Symmetry reconciliation** — backfilling the reverse of an edge already declared
  on the other side — is exempt from both freeze and the dependents block (it changes no meaning).
- `runGate` — the gate-proof runner: executes a gate's `criteria_check.runnable`, maps exit 0→
  `cleared` / non-zero→`failed` (bidirectional), leaves the human-owned `partial` flag untouched.
  Fail-closed on a missing/bad runnable.

**`@dreamrock/governor-cli`**

- `governor new <type> --title … [--parent … | --blocks … | …]` — create + initialize a node.
- `governor set <id> <field> <value>` — plain scalar only (structural→`edge`, status→`status`).
- `governor edge add|rm <from> <kind> <to>` — structural edge, both sides maintained.
- `governor status <id> <new-status>` — work/plan transitions (refuses gates → `gate run`).
- `governor gate run <id> | --all` — run a gate's proof and write its status.

### Fixed

- `renderIndex` now emits the INDEX **with** its `node_type: index` frontmatter (preserving an
  existing index node's, or synthesizing one), so a regenerated `INDEX.md` remains a valid
  governance node and round-trips through the loader. Previously the generated view was
  frontmatter-less and dropped the index node from the graph on regeneration.

### Verification

Dogfood loop closed: backfilling all 12 of slice-1's `asymmetric-edge` drifts through
`governor edge add` (each a symmetry reconciliation) makes `governor check` exit 0 on the H3G tree —
the write path produces a tree the validator fully accepts.

### Added — core foundation + read-only CLI

The first working slice of the engine, built against the H3G `.governance/` reference tree.

**`@dreamrock/governor-core`**

- `loadGovernance(root)` — walk a `.governance/` tree and parse every node; non-node markdown (no
  `id` + `node_type`) is skipped.
- `splitFrontmatter(source)` — split a markdown document into parsed YAML frontmatter + prose body
  (delegates to `@std/yaml`; preserves `---` rules in the body).
- `buildGraph(nodes, taxonomy)` — build the in-memory typed graph per run; materialize declared
  edges and derive the structural reverse of each so the graph is symmetric in memory.
- `blastRadius(graph, nodeId, kind)` — derived downstream-reach traversal over structural edges
  (read-only; the advisory-vs-blocking policy belongs to the caller).
- `validate(graph, taxonomy)` — the single validation core (one core, two entry points): id grammar
  with prefix↔type agreement (alias-aware), node-type membership, per-type status enum, uid shape +
  uniqueness, monotonic `{NN}` uniqueness, structural-edge symmetry, and dangling-edge detection.
- `DEFAULT_TAXONOMY` + `mergeTaxonomy`/`resolvePrefix` — the shipped node-type/status/edge
  vocabulary, built to accept a repo override map later (portability seam, design control 3).
- `renderIndex(graph, taxonomy)` — generate the INDEX markdown view (node-bucket counts, project
  root pointer, masterplan listing) from the graph.

**`@dreamrock/governor-cli`**

- `governor check [--root] [--json]` — run the standalone validator; exit 1 iff any `error`.
  `--json` emits machine-readable findings (CI seam).
- `governor index [--root] [--write]` — print the regenerated INDEX, or overwrite `INDEX.md` with
  `--write`.
- `governor version` / `--help`.

### Notes

- Verified end-to-end against H3G's `.governance/` tree: all 81 nodes parse cleanly; the validator
  surfaces only genuine one-sided structural-edge drift (the hand-authored tree predates the
  edge-maintaining CLI). INDEX regeneration reproduces the committed bucket counts exactly.
- Out of scope (next slice): `new`/`set`/`edge`/`status` write path, `{NN}` counter persistence,
  gate-proof runner, freeze enforcement, review-boundary check, signing/authority stamping.
