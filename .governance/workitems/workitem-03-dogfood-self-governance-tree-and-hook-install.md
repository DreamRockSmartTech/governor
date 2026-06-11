---
uid: bc32f4e3-31ee-44ea-9e99-f1665dca2dae
id: workitem-03-dogfood-self-governance-tree-and-hook-install
node_type: workitem
status: complete
title: "Dogfood: self-governance tree and hook install"
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Make Governor govern itself: bootstrap this `.governance/` tree entirely through the CLI write
path, run `governor init`, and adapt the policy hooks to run Governor from source. Heal the H3G
reference tree as the real-world write-path E2E.

## Evidence

ADR-0001 had explicitly deferred the self-governance tree; the assessment flagged it (W4) along
with H3G's 12 re-accumulated asymmetric-edge errors, missing counters.json, and uninstalled hooks —
proof that value only arrives when init actually runs.

## Approach

Tree: project → masterplan (road-to-v1) → per-slice workitems. H3G: 13 `governor edge add`
reconciliations → 82 nodes, 0 errors; hooks installed there too (signing mandate satisfied by
setting commit.gpgsign + gpg.program). Dogfood friction found and embraced: seeded policy hooks
assume a `governor` binary, so both repos' policy hooks call the source checkout — exactly the
repo-owned customization the Husky-shaped design intends.
