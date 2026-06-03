# Changes

All notable changes to Governor are recorded here. Versions follow
[Semantic Versioning 2.0.0](https://semver.org/).

## Unreleased

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
