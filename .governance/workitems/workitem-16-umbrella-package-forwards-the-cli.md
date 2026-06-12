---
uid: 0c7e4e8f-4ab8-45d2-ab5b-4f8770161a11
id: workitem-16-umbrella-package-forwards-the-cli
node_type: workitem
status: open
title: Umbrella package forwards the CLI
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Make the headline package `@dreamrock/governor` serve both the library and the
tool: add a `./cli` export that forwards the reference CLI, so a single install
command (`deno install -gA -n governor jsr:@dreamrock/governor/cli`) delivers
the complete default experience. Update README install instructions and the
umbrella module documentation accordingly.

## Evidence

Before this change the umbrella package re-exported only the core library,
while the CLI — the tool a newcomer actually wants first — required knowing a
second package name (`@dreamrock/governor-cli`). A user who reaches for the
obvious headline name got a library with no runnable entry point: a
discoverability dead end at the exact moment of first contact. The umbrella's
own module doc promised it would "become the umbrella that re-exports across
core and frontends" as the toolkit grows; the CLI is the first frontend, so
this is that promised growth step, not a new direction.

## Approach

`@dreamrock/governor-cli` gains a programmatic `main(args): Promise<number>`
entry point (an `import.meta.main` block cannot fire through a re-export, so a
callable seam is required); its own `import.meta.main` block now delegates to
it. The umbrella adds `cli.ts` — a thin forwarder that re-exports `main` (and
the CLI's version as `CLI_VERSION`) and runs it when executed directly — wired
as the `./cli` export with a `@dreamrock/governor-cli@^0.2.0` dependency.
Library consumers importing `.` never fetch CLI modules (per-path resolution),
so the aggregation costs library users nothing. Rejected: folding the CLI's
code into the umbrella (duplicates the package; the forwarder keeps
`governor-cli` the single source of truth).