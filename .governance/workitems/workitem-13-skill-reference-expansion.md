---
uid: fd1dde40-9da9-4f38-9ffe-a7adbf902d59
id: workitem-13-skill-reference-expansion
node_type: workitem
status: complete
title: Skill reference expansion
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Restructure `@dreamrock/governor-skill` from a single SKILL.md into the full skill-directory
format — `SKILL.md` (lean core) + `references/{interview,cli,structure}.md` (progressive
disclosure) — and make the installer ship the whole directory. SKILL.md keeps the two rules, the
four phases compressed, and the hook playbook; each reference carries the depth an agent loads on
demand.

## Evidence

A post-dogfood audit of the skill against the source `/grill-me` methodology found three gaps:
(1) the interview was distilled from 340 lines to 5 steps, losing the question taxonomy,
interaction patterns, anti-patterns, and checkpoint format — agents following only the summary
batch vague questions and drift; (2) the skill predated the gate-enforcement work and never taught
the gate-proof commit blocker, the `partial: true` on-record bypass, the `.governance/checks/`
proof-script convention, or the fresh-window `criteria_check` hand-authoring (rule 1's absolute
"never hand-edit frontmatter" left agents no legal way to author a gate runnable); (3) no
structure/ownership map of `.governance/` existed — the explicit anti-drift fence was missing.

## Approach

Three references, one concern each: `interview.md` is the full grill-me method re-grounded in
governance vocabulary (branches → epics, locked rulings → decision nodes, open items →
`blocked_by`); `cli.md` is the command reference plus the lifecycle recipes including the one
sanctioned hand-edit (fresh-gate `criteria_check`) and the partial-bypass audit trail; and
`structure.md` is the layout/ownership-zone map ending in the "never do" drift fence. The
installer gained a `SKILL_FILES` manifest and per-file idempotency (aggregate action: any write
wins over unchanged) rather than a tarball-style copy, so re-running upgrades only stale files.
Rejected: keeping a single fat SKILL.md (always-loaded context cost for depth needed only
situationally) and `import`-time bundling of references into mod.ts (the files are the artifact —
agents read them from disk).
