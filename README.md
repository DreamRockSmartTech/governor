# Governor

Portable, git-native governance for any repository.

Governor models a project's governance as a **typed node-graph** — charters, plans, epics,
gates, decisions, and work items — stored as plain files in the repo and enforced with
integrity, schema, and signature-backed authority checks. The graph degrades to plain
`ls`/`cat`; no renderer or service is required.

> **Status:** early scaffold (`0.0.1`). The published versions today are namespace-reservation
> stubs; the real API lands in later releases.

## Packages

This is a Deno workspace publishing three [JSR](https://jsr.io) packages:

| Package | Role |
|---|---|
| [`@dreamrock/governor-core`](https://jsr.io/@dreamrock/governor-core) | The frontend-agnostic governance library — the engine every frontend consumes. |
| [`@dreamrock/governor-cli`](https://jsr.io/@dreamrock/governor-cli) | The reference command-line frontend. |
| [`@dreamrock/governor`](https://jsr.io/@dreamrock/governor) | Umbrella / convenience package. |

Building an extension or alternate frontend (e.g. a VSCode extension)? Depend on
`@dreamrock/governor-core`.

## Development

```sh
deno task check   # type-check all packages
deno task lint
deno task fmt
```

## License

[MIT](./LICENSE) © DreamRock SmartTech LLC
