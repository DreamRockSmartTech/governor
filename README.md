# Governor (WIP PRE-ALPHA - NOT STABLE)

Portable, git-native governance for any repository.

Governor models a project's governance as a **typed node-graph** — charters, plans, epics, gates,
decisions, and work items — stored as plain files in the repo and enforced with integrity, schema,
and signature-backed authority checks. The graph degrades to plain `ls`/`cat`; no renderer or
service is required.

> **Status:** early development (`0.0.1`). The first working slice of the engine has landed: a repo
> can be loaded, validated, mutated, and have its gates run. The commands below are **plumbing** —
> precise, graph-aware primitives (à la git). Task-shaped **porcelain** that wraps them for everyday
> human use comes later.

## Commands

```sh
# Setup
governor init [--root <path>]              # install git hooks + assert the signing mandate

# Read
governor check [--root <path>] [--json]    # validate a .governance/ tree (exit 1 on any error)
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
seeds editable policy hooks in `.governance/hooks/`. The default `pre-commit` runs `governor check`
and rejects a commit when the tree is invalid; teams edit/extend the policy hooks freely. Bypass
with `GOVERNOR=0` (or `git --no-verify`).

`check` runs the schema/grammar validator (id grammar, node type, status enum, uid, monotonic `{NN}`
uniqueness) and graph-integrity checks (structural-edge symmetry, dangling edges) over the whole
tree. `index` renders the INDEX projection — generated, never hand-maintained.

The write commands enforce the governance controls: **frozen** nodes (those with an inbound
structural edge) refuse edits — supersede them instead; a structural change on a node with
**dependents** is blocked and routed to supersession; `set` handles plain scalars only (structural
edges go through `edge`, status through `status`); and `gate run` executes a gate's declared
`criteria_check.runnable`, writing `cleared`/`failed` from its exit code. Pure **symmetry
reconciliation** (backfilling the reverse of an edge that already exists) is exempt from the freeze
and dependents guards so drift can be repaired.

## Packages

This is a Deno workspace publishing three [JSR](https://jsr.io) packages:

| Package                                                               | Role                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`@dreamrock/governor-core`](https://jsr.io/@dreamrock/governor-core) | The frontend-agnostic governance library — the engine every frontend consumes. |
| [`@dreamrock/governor-cli`](https://jsr.io/@dreamrock/governor-cli)   | The reference command-line frontend.                                           |
| [`@dreamrock/governor`](https://jsr.io/@dreamrock/governor)           | Umbrella / convenience package.                                                |

Building an extension or alternate frontend (e.g. a VSCode extension)? Depend on
`@dreamrock/governor-core`.

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
