# Governor (WIP PRE-ALPHA - NOT STABLE)

Portable, git-native governance for any repository.

Governor models a project's governance as a **typed node-graph** — charters, plans, epics, gates,
decisions, and work items — stored as plain files in the repo and enforced with integrity, schema,
and signature-backed authority checks. The graph degrades to plain `ls`/`cat`; no renderer or
service is required.

> **Status:** early development (`0.0.1`). The first working slice of the engine has landed: a repo
> can be loaded, validated, and have its INDEX regenerated. The mutation/creation path
> (`new`/`set`/`edge`), the gate-proof runner, and freeze enforcement are still to come.

## Commands (current)

```sh
governor check [--root <path>] [--json]   # validate a .governance/ tree (exit 1 on any error)
governor index [--root <path>] [--write]  # regenerate the INDEX view (stdout, or --write the file)
governor version
```

`check` runs the schema/grammar validator (id grammar, node type, status enum, uid, monotonic `{NN}`
uniqueness) and graph-integrity checks (structural-edge symmetry, dangling edges) over the whole
tree. `index` renders the INDEX projection from the graph — it is generated, never hand-maintained.

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
