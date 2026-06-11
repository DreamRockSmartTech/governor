---
uid: c4dfe105-1f40-482a-9b45-7802439d46e6
id: masterplan-01-road-to-v1
node_type: masterplan
status: open
title: Road to v1
owner: j.bellero@dreamrocksmarttech.com
parent: project-01-governor
children:
  - workitem-01-freeze-direction-and-status-exemption-adr-0002
  - workitem-02-taxonomy-seam-repo-override-derived-freeze-and-blast-radius
  - workitem-03-dogfood-self-governance-tree-and-hook-install
  - workitem-04-yaml-date-round-trip-corruption
  - workitem-05-staged-snapshot-check-out-of-band-enforcement
  - workitem-06-legacy-criteria-check-warning-and-gate-partial-display
  - workitem-07-agent-skill-package
  - workitem-08-cli-robustness-nits
  - workitem-09-gate-run-partial-display
  - workitem-10-cli-integration-harness
  - workitem-11-continuous-integration-workflow
  - workitem-12-release-zero-one-zero-prep
  - workitem-13-skill-reference-expansion
decisions:
  - decision-01-approval-authority-exclude-approved-by-keep-owner-auto-stamp
  - decision-02-freeze-direction-depended-upon-node-freezes-status-is-workflow-exempt
---

## Description

The v1 roadmap for Governor, derived from a code-quality assessment of the pre-0.1.0 codebase
(June 2026). Seven weaknesses were identified (W1–W7); this masterplan addresses them through
twelve workitems across six phases.

**Phase A (workitems 01–04):** Taxonomy seam end-to-end. The two hard-coded kind-sets
(`FREEZING_KINDS`, `STRUCTURAL_FORWARD`) were replaced by `freezes`/`toDependent` flags on `EdgeKind`
derived from the taxonomy. The repo-override file (`.governance/taxonomy.json`) is now loaded at a
single CLI resolve point (`loadTree`). ADR-0002 corrected the freeze direction (workitem-01) and a
YAML date round-trip corruption bug was fixed (workitem-04).

**Phase B (workitem-05):** `governor check --staged` — the out-of-band enforcement keystone. Staged
snapshot compared against HEAD; blocked frozen-node edits (body, fields, deletion) and symmetric
hand-made structural changes that `governor check` (snapshot-only) could not detect.

**Phase F (workitem-07):** `@dreamrock/governor-skill` — the agent skill package. SKILL.md teaches
coding agents the governed workflow: grill-me-derived design interview, node lifecycle via CLI,
prose tracking sections, hook-rejection playbook.

**Phase C (workitem-03):** Dogfood — Governor self-governed and H3G reference tree healed. Both
repos now live under Governor hooks.

**Phase D (workitems-06, 08–10):** CLI robustness hardening, integration test harness, CI workflow.

**Phase E (workitems-09, 11–12):** 0.1.0 release engineering — lockstep version bumps, JSR publish
workflow, README beta, CHANGES section.

## Decisions

- **decision-01:** Approval authority (`approved_by`) is out of scope; `owner` auto-stamped from
  committer. Gate authorization is by proof (gate-proof runner), not by human sign-off field.
- **decision-02:** Freeze protects the depended-upon node (parent, blocker, superseded record), not
  the dependent. Status transitions are workflow-exempt from freeze. Counterparty exclusion on edge
  dissolution.

## Outcome

All 12 workitems complete. 142/142 tests. `deno publish --dry-run` green. Self-governance clean
under `governor check --staged`. Release candidate ready on `feature/taxonomy-seam`.
