---
uid: 99c033c5-5783-4511-9c78-7f2d6757680c
id: workitem-05-staged-snapshot-check-out-of-band-enforcement
node_type: workitem
status: complete
title: "Staged snapshot check: out-of-band enforcement"
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

`governor check --staged`: materialize the staged snapshot and HEAD from git blobs, validate the
snapshot, and judge the delta with boundary rules that mirror the CLI's own legality — the
out-of-band enforcement teeth for controls 1 and 5, wired into the default pre-commit hook.

## Evidence

Assessment finding W3: freeze was enforced only inside CLI mutations, and a *symmetric* hand edit
of structural frontmatter (both sides edited consistently) passed `governor check` — the control-5
keystone ("out-of-band structural change = HARD FAIL") was only real for asymmetric edits. Verified
live before/after: a symmetric hand-made blocks/blocked_by pair scored 0 errors under plain check
and is blocked by --staged with both endpoints named.

## Approach

Pure core (`stagedBoundary`): frozen-node body/field/deletion edits block; `status` stays exempt
(ADR-0002); edge additions pass as reconciliation-vs-HEAD or new-node wiring; symmetric pair
add/remove passes iff at least one direction of `governor edge` could have performed it at HEAD
(freeze + dependents, counterparty excluded); `criteria_check` changes block on gates that are
frozen or depended upon. The CLI gathers git state (`lsTree`/`lsStaged`/`showFile`); the working
tree plays no part, so what is checked is exactly what the commit would record.
