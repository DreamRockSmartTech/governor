# Contributing to Governor

Thanks for considering a contribution. Two things are non-negotiable before your first pull request
can merge; the rest is ordinary hygiene.

## 1. Contributor License Agreement (required)

All contributors must agree to the [Contributor License Agreement](CLA.md) before their first
contribution is merged. The CLA lets you keep ownership of your work while granting DreamRock
SmartTech LLC the rights needed to steward the project, including offering Governor under additional
license terms.

To agree, include this statement in the description of your first pull request:

> I have read the Governor Contributor License Agreement (CLA.md, Version 1.0) and I agree to its
> terms for all my contributions to this project.

## 2. Governance discipline (required)

Governor governs itself with its own `.governance/` tree, and the installed git hooks enforce it:

- Every commit must stage **exactly one WorkItem node** that describes the change it binds
  (`deno task gov new workitem --title "…" --parent …`).
- WorkItems carry real prose — `## Description`, `## Evidence`, and `## Approach` — written **at
  creation**, not backfilled.
- Commits must be GPG-signed.
- `deno task gov check --staged` runs at pre-commit and must pass.

Run `deno task gov next` to see unblocked open WorkItems, and `deno task gov work <id>` for
orientation on any node.

## Development

```sh
deno task check   # type-check core/ cli/ meta/ skill/
deno task lint    # lint
deno task fmt     # format
deno task test    # unit + e2e tests
deno task gov     # run the governor CLI from source
```

All four of check/lint/fmt/test must be clean before a pull request.

## Licensing

Governor is licensed under the [Business Source License 1.1](LICENSE) (SPDX: `BUSL-1.1`): free for
individuals, non-profits, education, and small organizations, with a commercial license required for
production use beyond the Additional Use Grant. Each released version automatically converts to
Apache-2.0 four years after its release. The CLA exists so that contributions can be licensed under
these terms — including commercial licenses and the Apache-2.0 conversion — without per-contributor
renegotiation.
