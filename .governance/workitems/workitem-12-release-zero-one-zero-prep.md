---
uid: f25d806c-aa70-481d-848c-008802fbd6a7
id: workitem-12-release-zero-one-zero-prep
node_type: workitem
status: complete
title: Release zero one zero prep
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Prepare the 0.1.0 release candidate: bump all four packages 0.0.1 → 0.1.0 in lockstep (manifests,
VERSION constants, cli→core `^0.1.0` dependency), exclude tests from published tarballs, move the
README from "WIP PRE-ALPHA" to beta with install instructions and an explicit POSIX-only
declaration, add the CHANGES 0.1.0 section, and sync stale pre-implementation wording.

## Evidence

Assessment finding W7 (release readiness) and the SemVer rule that the manifest is the single
source of truth with in-code constants in lockstep. `deno publish --dry-run` green for all four
packages. Stale wording found in the sweep: cli/mod.ts still said "commands in this release are
read-only"; meta/mod.ts called itself a namespace-reservation stub (it now re-exports core in
full); DESIGN.md said "pre-implementation".

## Approach

0.1.0 signals a working pre-1.0 public API per SemVer. Remaining release steps that need a human:
push + PR, link the four packages to the repo in JSR settings, first publish (locally or via the
tag workflow), then tag v0.1.0.
