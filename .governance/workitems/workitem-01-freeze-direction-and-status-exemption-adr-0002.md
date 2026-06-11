---
uid: d853ada5-9630-4d10-ac72-39ec8b3dad4e
id: workitem-01-freeze-direction-and-status-exemption-adr-0002
node_type: workitem
status: complete
title: Freeze direction and status exemption (ADR-0002)
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Reverse the freeze direction (control 1) so the **depended-upon** node freezes — `parent`/
`blocked_by`/`supersedes` are the freezing kinds — and exempt `status` transitions from the freeze
guard. Add counterparty exclusion: dissolving an edge ignores the freeze that edge itself created.

## Evidence

Pre-implementation verification on a scratch tree: a workitem created with `--parent` was frozen at
birth by the derived `children` edge — `set` and `done` both exited 1 with the supersession error.
The H3G reference tree declares `parent` on 27 nodes, so the porcelain loop was unusable on real
trees. Ruled by Justin (two-option decision); recorded as ADR-0002, reversing the slice-2
refinement.

## Approach

Red/green: rewrote freeze.unit.ts to the flipped expectations first (5 failures), then flipped
`FREEZING_KINDS`, removed the guard from `transitionStatus`, and threaded an `ignoring` counterparty
through `guardMutation`. The dependents guard was kept — it independently catches one-sided drift.
