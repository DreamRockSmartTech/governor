---
uid: 13956871-1d76-4c78-9933-fb4f74518bab
id: decision-02-freeze-direction-depended-upon-node-freezes-status-is-workflow-exempt
node_type: decision
status: accepted
title: 'Freeze direction: depended-upon node freezes, status is workflow-exempt'
owner: j.bellero@dreamrocksmarttech.com
---

## Context

Control 1 says a node freezes "the moment another node points a structural edge at it," but the
in-memory graph maintains both sides of every edge, so every node in a structural relationship has
an inbound edge — the rule needs a direction. The slice-2 implementation chose `children/blocks/
supersedes` as the freezing kinds, which freezes the **dependent** node. Dogfooding against a real
tree (the H3G reference tree with 27 parented nodes) surfaced the consequence: a workitem created
with `--parent epic-X` is frozen at birth and can never be edited, transitioned, or completed. The
porcelain pick → orient → finish loop fails on essentially every node in a real tree.

The deeper inconsistency: blast radius and the dependents guard (control 4) already treat
`children/blocks/supersedes` targets as the dependents — the nodes *relying on* the source. Freeze
exists to protect what is relied upon. The slice-2 direction froze the wrong end.

## Decision

1. **Freeze protects the depended-upon node.** Freezing kinds are the reliance-declaring inbound
   edges: `parent` (a child derives from this node), `blocked_by` (something waits on this node),
   `supersedes` (this node is a superseded historical record). The dependent — child, blocked item,
   superseder — is not frozen by the relationship; it is the living workflow end.
2. **Status transitions are exempt from the freeze guard.** Freeze locks a node's meaning (title,
   prose, plain fields, structural edges). `status` is workflow state: a frozen epic must still be
   completable when its children are done. Gate status was already machine-owned by the runner;
   work/plan status now behaves consistently.
3. **Counterparty exclusion on edge dissolution.** Removing edge `A —kind→ B` ignores freeze on `A`
   contributed by `B` — the relationship being dissolved cannot block its own dissolution.

## Consequences

The porcelain loop works on real trees. A parented workitem can be set, transitioned, and completed.
The `done` command on a frozen epic succeeds when its children are done. The `supersedes` direction
was already correct — a superseded node remains frozen. The slice-2 unit tests (freeze.unit.ts,
mutate.unit.ts, work.unit.ts) encode the new direction.

Additionally: weak (non-structural, non-freezing) edge kinds — `decisions`, `cites`, `cited_by`,
`gates`, `consumes_gate` — are exempt from the freeze guard on `governor edge add`, so annotation
edges can always be added to frozen nodes without superseding them.

Full rationale: [docs/decisions/ADR-0002-freeze-direction.md](../../docs/decisions/ADR-0002-freeze-direction.md)
