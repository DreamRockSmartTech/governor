---
uid: 6c428b3b-f3ff-4544-b388-a1d7b1157994
id: workitem-06-legacy-criteria-check-warning-and-gate-partial-display
node_type: workitem
status: complete
title: Legacy criteria check warning and gate partial display
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Warn (never block) when a gate's `criteria_check` is a legacy prose string rather than the
structured `{runnable, …}` block, so migrating hand-authored trees see that `gate run` would fail
closed on it. (The companion `partial` display landed separately under workitem-09.)

## Evidence

All 5 H3G gates carry prose criteria — under control 2's fail-closed runner, every `gate run` on
them would report `failed` with no explanation of why. Surfaced by the H3G validation pass after
the gate-binding vocabulary landed.

## Approach

A `legacy-criteria-check` warn-severity finding in the single validation core; exit code stays 0
(warnings never block — migration pressure, not migration blockade).
