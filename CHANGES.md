# Changes

All notable changes to Governor are recorded here. Versions follow
[Semantic Versioning 2.0.0](https://semver.org/).

## Unreleased

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
