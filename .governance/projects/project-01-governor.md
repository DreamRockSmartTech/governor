---
uid: f198852a-1531-4c4c-8ed0-69b41ca32045
id: project-01-governor
node_type: project
status: active
title: Governor
owner: j.bellero@dreamrocksmarttech.com
children:
  - masterplan-01-road-to-v1
---

## Description

Governor is DreamRock's portable, git-native governance toolkit. It models a project's governance as
a typed node-graph — projects, masterplans, epics, gates, decisions, and workitems — stored as plain
markdown files with YAML frontmatter under `.governance/`, validated and enforced by six programmatic
controls wired into git hooks.

The foundational invariant: **structure is CLI-mediated for everyone; prose is free-edit for
everyone.** Git history is the authority; commit signing is the trust root. Because the structural
path is singular (the CLI), every guarantee holds regardless of whether a human or an AI agent is
doing the work — making governance *trustworthy* rather than *hopeful*.

Governor was derived from the H3G project's hand-authored `.governance/` tree, which drifted exactly
the way hand-maintained structure drifts. It exists to make the guarantees that tree was intended to
provide actually enforceable.

## Status

Active — `0.1.0` release candidate on `feature/taxonomy-seam`. Engine is complete and self-governed:
Governor's own `.governance/` tree is enforced by its own hooks, and H3G's reference tree is healed
and live under the same enforcement.
