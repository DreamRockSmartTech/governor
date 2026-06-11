---
uid: cdee8ad4-f144-4203-a0d1-344a47235ef7
id: gate-02-publish-dry-run-green
node_type: gate
status: cleared
title: Publish dry-run green
owner: j.bellero@dreamrocksmarttech.com
criteria_check:
  runnable: .governance/checks/publish-dry-run.sh
  description: Runs `deno publish --dry-run` across all four workspace packages
  expectation: 'Every package type-checks, packs, and passes JSR publish validation — the 0.1.0 release shape is sound'
guarded_by:
  - workitem-12-release-zero-one-zero-prep
---

## Description

Machine proof that the release is publishable: a JSR publish dry-run over all four packages
(`@dreamrock/governor-core`, `-cli`, `-skill`, `@dreamrock/governor`). Catches manifest errors,
broken exports, type errors in the published graph, and accidental tarball inclusions — the things
that would otherwise surface only at the real `deno publish` on tag day.

## Evidence

Produced by workitem-12 (0.1.0 release prep). The dry-run was run by hand during release prep; this
gate makes it a standing, machine-owned proof instead of a one-time manual verification.

## Approach

`--allow-dirty` is deliberate: this proof runs from the pre-commit hook, when the working tree
legitimately differs from HEAD. The runnable lives in `.governance/checks/` so the proof itself is
committed and reviewable.
