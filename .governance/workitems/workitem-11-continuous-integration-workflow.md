---
uid: 9a0034f2-eb4f-4f58-ac5e-eeeec9c3286c
id: workitem-11-continuous-integration-workflow
node_type: workitem
status: complete
title: Continuous integration workflow
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

GitHub Actions: a CI workflow (fmt --check, lint, type-check, unit+e2e tests, `governor check` on
this repo's own governance tree, and a JSR publish dry-run) on every push/PR, plus a tag-triggered
publish workflow releasing all workspace packages to JSR via GitHub OIDC.

## Evidence

Assessment finding W6: no CI existed — the four gates ran only when someone remembered. The repo's
merged-PR flow gives the workflow something to hang on.

## Approach

`denoland/setup-deno@v2` with `deno-version: v2.x`; the CI steps mirror the local task chain
exactly so a green local run predicts a green CI run. The publish job re-verifies before
publishing; OIDC (`id-token: write`) replaces token secrets — the packages must be linked to this
repository in JSR settings once.
