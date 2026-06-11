# Governor (WIP PRE-ALPHA - NOT STABLE)

Portable, git-native governance for any repository.

Governor models a project's governance as a **typed node-graph** — charters, plans, epics, gates,
decisions, and work items — stored as plain files in the repo and enforced with integrity, schema,
and signature-backed authority checks. The graph degrades to plain `ls`/`cat`; no renderer or
service is required.

> **Status:** early development (`0.0.1`). The engine is working end-to-end: a repo can be loaded,
> validated, mutated, gated, and governed via git hooks — with both **plumbing** (precise,
> graph-aware primitives) and **porcelain** (task-shaped `next`/`work`/`done`) command layers, à la
> git.

## Commands

```sh
# Setup
governor init [--root <path>]              # install git hooks + assert the signing mandate

# Workflow (porcelain)
governor next [--root <path>]              # list unblocked open WorkItems ("what can I do?")
governor work <id>                         # orientation view for a node (read-only)
governor done <id>                         # run the produced gate, then complete the node

# Read
governor check [--root <path>] [--json] [--staged]
                                           # validate a .governance/ tree (exit 1 on any error);
                                           # --staged: the staged snapshot + out-of-band rules vs HEAD
governor index [--root <path>] [--write]   # regenerate the INDEX view (stdout, or --write the file)

# Write (plumbing)
governor new <type> --title <t> [--parent <id> | --blocks <id> | …]   # create + initialize a node
governor set <id> <field> <value>          # set a plain frontmatter scalar
governor edge add|rm <from> <kind> <to>    # add/remove a structural edge (both sides maintained)
governor status <id> <new-status>          # transition a work/plan status
governor gate run <id> | --all             # run a gate's proof; write its machine-owned status
governor review-check <msg-file>           # review-boundary check (one WorkItem/commit; hook-invoked)

governor version
```

`init` installs Governor into a repo's git lifecycle (Husky-shaped). It asserts the signing mandate
(failing hard if `user.name`/`user.email`/`commit.gpgsign`/`gpg.program`/`user.signingkey` are
unset), points `core.hooksPath` at `.governance/hooks/_` (a generated, gitignored engine layer), and
seeds editable policy hooks in `.governance/hooks/`. The default `pre-commit` runs
`governor check --staged` and rejects a commit when the staged snapshot is invalid **or contains an
out-of-band change vs HEAD** (frozen-node edits, hand-made structural changes the CLI would have
refused); teams edit/extend the policy hooks freely. Bypass with `GOVERNOR=0` (or
`git --no-verify`).

The **workflow** commands are porcelain — thin, task-shaped compositions of the plumbing (the way
git `pull` wraps `fetch`+`merge`). `next` finds ready work, `work` orients you on an item, and
`done` runs its gate and completes it. They add no new guarantees; they're convenience over the
primitives.

`check` runs the schema/grammar validator (id grammar, node type, status enum, uid, monotonic `{NN}`
uniqueness) and graph-integrity checks (structural-edge symmetry, dangling edges) over the whole
tree. `index` renders the INDEX projection — generated, never hand-maintained.

Every command resolves the repo's **effective taxonomy**: the shipped defaults, optionally extended
by a `.governance/taxonomy.json` override (node types, status enums, edge kinds with their
`structural`/`freezes`/`toDependent` semantics, id-prefix aliases). Repo-defined vocabulary
participates fully in validation, symmetry, freeze, and blast radius.

The write commands enforce the governance controls: **frozen** nodes (those with an inbound
structural edge) refuse edits — supersede them instead; a structural change on a node with
**dependents** is blocked and routed to supersession; `set` handles plain scalars only (structural
edges go through `edge`, status through `status`); and `gate run` executes a gate's declared
`criteria_check.runnable`, writing `cleared`/`failed` from its exit code. Pure **symmetry
reconciliation** (backfilling the reverse of an edge that already exists) is exempt from the freeze
and dependents guards so drift can be repaired.

## Packages

This is a Deno workspace publishing four [JSR](https://jsr.io) packages:

| Package                                                                 | Role                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`@dreamrock/governor-core`](https://jsr.io/@dreamrock/governor-core)   | The frontend-agnostic governance library — the engine every frontend consumes. |
| [`@dreamrock/governor-cli`](https://jsr.io/@dreamrock/governor-cli)     | The reference command-line frontend.                                           |
| [`@dreamrock/governor-skill`](https://jsr.io/@dreamrock/governor-skill) | The agent skill — teaches a coding agent the governed workflow (below).        |
| [`@dreamrock/governor`](https://jsr.io/@dreamrock/governor)             | Umbrella / convenience package.                                                |

Building an extension or alternate frontend (e.g. a VSCode extension)? Depend on
`@dreamrock/governor-core`.

## Agent skill

The hooks are the enforcing layer; the **skill is the cooperative layer** (defense in depth — see
DESIGN.md control 6). It instructs a coding agent working in a governed repo to synchronize with the
user through an adversarial design interview before coding, encode the agreed work as governance
nodes through the CLI, track sessions in free-edit prose, and finish through gates with one WorkItem
per commit. Install it into a repo's agent-skills directory:

```sh
deno run -A jsr:@dreamrock/governor-skill/install              # → .claude/skills/governor/
deno run -A jsr:@dreamrock/governor-skill/install --dest <dir> # custom location
```

Re-running upgrades a stale copy in place and leaves a current one untouched.

## Design

The authoritative design — the six governance controls, the authority/record model, and the data
structures — is documented in [docs/DESIGN.md](./docs/DESIGN.md). It is the design of record for the
pre-implementation phase.

## Development

```sh
deno task check   # type-check all packages
deno task lint
deno task fmt
deno task test    # run the test suite
```

Tests live in each package's `tests/` directory (never alongside source) and are named by the kind
of test they are — unit tests use the `*.unit.ts` suffix. Fixtures live under `tests/testdata/`.

## License

[MIT](./LICENSE) © DreamRock SmartTech LLC
