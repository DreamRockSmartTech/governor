---
uid: 2604563a-53b4-419a-bb92-7f34d3580836
id: workitem-10-cli-integration-harness
node_type: workitem
status: complete
title: CLI integration harness
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

A CLI integration suite (`cli/tests/cli.e2e.ts`, `*.e2e.ts` joins the test task) that drives the
command runners and the installed hooks against real temp git repositories — automating everything
previous slices verified by hand on scratch repos.

## Evidence

Assessment finding W6: no CLI-level tests for `init`/`new`/`set`/`edge`/`status`/`gate` — exactly
the I/O-heavy paths; all hook/init E2E verification was manual. The freeze-direction bug (ADR-0002)
slipped through precisely because the porcelain E2E was a one-off manual scratch run.

## Approach

Eight tests, ~0.4 s: init mandate fail-hard / two-tier install / idempotency / policy no-clobber;
new→set→done with counters bootstrap and freeze semantics; bidirectional gate runs; done refusing
on a failing produced gate; check --staged against a real index; review-check block/override/
binding; and actual `git commit` through the installed hooks, including the trailer stamped by git
and the GOVERNOR=0 bypass. Fixtures satisfy the signing mandate with fake config and commit with
`-c commit.gpgsign=false`.
