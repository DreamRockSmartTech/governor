---
uid: 7e52fa0e-4b05-4f89-96f3-69c9e7462bfb
id: workitem-15-usage-protections-for-publication
node_type: workitem
status: complete
title: Usage protections for publication
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Establish the project's usage and contribution terms ahead of first publication:
adopt the Business Source License 1.1 (`LICENSE`), add a Contributor License
Agreement (`CLA.md`), and add a `CONTRIBUTING.md` that makes CLA assent a merge
precondition and documents the project's governance discipline for contributors.

## Evidence

Open-source infrastructure tooling is routinely exposed to a well-documented
sustainability problem: heavy production use without any form of reciprocal support
for the project's maintenance. BUSL-1.1 is an established, compliance-recognized
response (MariaDB, HashiCorp, CockroachDB): it keeps the source open and free for
individuals, education, non-profits, and small organizations, while production use
beyond the Additional Use Grant requires a commercial license — and every release
automatically converts to Apache-2.0 after four years. The terms must land before the
first JSR publish because published versions are immutable, and JSR accepts BUSL-1.1
as a valid SPDX license identifier, so the publish path is unaffected. A CLA is
required at the same time: it is only meaningful if it covers every external
contribution from the first one onward.

## Approach

LICENSE carries the canonical BUSL-1.1 Terms verbatim (HashiCorp-layout) with
project parameters: small-organization Additional Use Grant tiers measured across
affiliates, a defined competitive-offering exclusion anchored to the Licensed Work
itself, four-year per-version Change Date, Apache-2.0 Change License. The
`BUSL-1.1` SPDX identifier is declared in each workspace package's `deno.json`,
and the LICENSE text ships inside every package (workspace subdirectories don't
inherit the root file). The CLA is modeled on the Apache ICLA as a
license grant (not a copyright assignment — contributors retain ownership), with
assent given by a stated line in a contributor's first pull request, automatable
later with CLA-assistant tooling. Both documents are subject to IP-counsel review
before the v0.1.0 tag. Rejected: DCO-only (certifies provenance but grants the
project no stewardship rights over contributions).

## Session log

- 2026-06-11 — Landed in `009ceac` as the 0.2.0 relicense (with version lockstep);
  pre-relicense MIT JSR versions yanked. Follow-up in this commit: `deno fmt`
  normalization of the prose documents (CLA, CONTRIBUTING, CHANGES, README) that
  broke the CI verify step, and status → complete.
