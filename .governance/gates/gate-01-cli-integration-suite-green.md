---
uid: 387b6051-4711-4daf-997f-e79dab82c17a
id: gate-01-cli-integration-suite-green
node_type: gate
status: cleared
title: CLI integration suite green
owner: j.bellero@dreamrocksmarttech.com
criteria_check:
  runnable: .governance/checks/e2e-suite.sh
  description: Runs the CLI integration suite (cli/tests/cli.e2e.ts) against real temp git repos
  expectation: 'All e2e tests pass — init, lifecycle, gate runner, staged boundary, review boundary, and installed hooks work end-to-end'
guarded_by:
  - workitem-10-cli-integration-harness
---

## Description

Machine proof that the CLI integration harness is green: the e2e suite drives the command runners
and the installed hooks against real temporary git repositories — `init` (mandate fail-hard,
idempotency, policy no-clobber), the `new`→`set`→`done` lifecycle, bidirectional gate runs, `done`
refusing over a failing gate, `check --staged` on a live index, `review-check`, and actual
`git commit` through the installed hooks.

## Evidence

Produced by workitem-10 (CLI integration harness). Before this gate existed, the suite ran only
when someone remembered (`deno task test`) — the self-governance tree had zero runnable gates,
meaning control 2 (gate-proof runner) was demonstrated nowhere in Governor's own governance.

## Approach

The runnable is a thin committed script under `.governance/checks/` (governance periphery, not
source) so the proof is itself tracked and reviewable. It runs the e2e suite specifically — the
end-to-end behavior is what this gate certifies; unit tests are the dev loop, not the gate proof.
