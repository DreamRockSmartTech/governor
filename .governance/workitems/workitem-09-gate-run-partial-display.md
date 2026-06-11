---
uid: 21f099ac-b29e-4d1b-a5e2-2de8cda3a5fe
id: workitem-09-gate-run-partial-display
node_type: workitem
status: complete
title: Gate run partial display
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Surface the human-owned `partial` bypass in `gate run` output: a failed gate whose `partial: true`
is set prints the on-record note that a human consciously accepted shipping over it (control 2's
escape hatch, visible to the operator instead of only to readers of the frontmatter).

## Evidence

Deferred from the Phase-B slice because it would have landed untested in an I/O runner; the
integration harness (workitem-10) plus a pure `partialNote` seam make it testable now.

## Approach

`partialNote(gate, status)` exported and unit-tested; the runner prints it under the status line.
Display-only — whether `done` should complete over a failed-but-partial gate is a separate design
decision, deliberately not taken here.
