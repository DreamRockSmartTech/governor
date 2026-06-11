---
uid: a6ca4c50-a063-4d73-971e-088f77a363a7
id: workitem-07-agent-skill-package
node_type: workitem
status: complete
title: Agent skill package
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

`@dreamrock/governor-skill` — the cooperative layer of control 6's defense-in-depth as an
installable package: a SKILL.md that teaches a coding agent the governed workflow, plus a one-shot
installer (`deno run -A jsr:@dreamrock/governor-skill/install`).

## Evidence

The AI-skill slice was deferred since the review-boundary slice ("skill shapes default behavior;
hook enforces proxies; reviewer judges decomposition"). Requested by Justin with two additions: the
synchronization interview must follow the grill-me methodology, and the skill must document the
free-form prose conventions used for review and tracking during agentic sessions.

## Approach

SKILL.md phases: (1) grill-me-derived sync interview — branches, one question per turn, dependency
hunting, checkpoints, and a hard gate (no code until the user confirms the workitem decomposition);
(2) node lifecycle through the CLI (one workitem ↔ one commit); (3) prose tracking sections
(Description / Evidence / Approach / Session log — the sections this very body uses); (4) commit
boundary behavior and a hook-rejection playbook. Installer is idempotent and upgrades stale copies;
the installed file is generated content, like a hook engine layer.
