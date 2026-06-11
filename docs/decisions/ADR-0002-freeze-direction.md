# ADR-0002 — Freeze direction: the depended-upon node freezes; status is workflow-exempt

- **Status:** Accepted
- **Date:** 2026-06-10
- **Supersedes wording in:** [DESIGN.md → control 1](../DESIGN.md) and the slice-2 implementation
  refinement (`FREEZING_KINDS = children/blocks/supersedes`)

## Context

Control 1 (frozen mandates) says a node freezes "the moment another node points a structural edge at
it." Because the CLI maintains both sides of every structural edge — and the in-memory graph derives
the reverse of any one-sided declaration — _every_ node in a structural relationship has an inbound
edge, so the rule needs a direction. The slice-2 implementation picked
`children`/`blocks`/`supersedes` as the freezing kinds, which freezes the **dependent**: a workitem
created with `--parent epic-X` is frozen at birth by the derived `children` edge.

Dogfooding against a real tree surfaced the consequence: a parented or blocked workitem can never be
edited (`set`), transitioned (`status`), or completed (`done`) — the porcelain pick → orient →
finish loop fails on essentially every node of a normally-shaped tree (the H3G reference tree
declares `parent` on 27 nodes). The slice-5 E2E had not caught this because its fixtures happened to
run `done` only on freeze-free nodes.

The deeper inconsistency: blast radius and the dependents guard (control 4) already treat
`children`/`blocks`/`supersedes` targets as the **dependents** — the nodes _relying on_ the source.
Freeze exists to protect what is relied upon (the mandate: a charter plans derive from, a blocker
something waits on). Freezing the dependent protects the wrong end.

## Decision

1. **Freeze protects the depended-upon node.** The freezing kinds are the reliance-declaring inbound
   edges: `parent` (a child derives from this node), `blocked_by` (something waits on this node),
   `supersedes` (this node is a superseded historical record). The dependent itself — child, blocked
   item, superseder — is _not_ frozen by the relationship.
2. **Status transitions are exempt from the freeze guard.** Freeze locks a node's _meaning_ (title,
   prose, plain fields, structural edges). `status` is workflow state: a frozen epic must still be
   completable when its children are done. Gate status was already exempt by construction
   (machine-owned by the runner); work/plan status now behaves consistently.
3. **Counterparty exclusion on edge dissolution.** Removing edge `A —kind→ B` ignores freeze on `A`
   contributed _by `B`_ — the relationship being dissolved cannot block its own dissolution (the
   same principle as the dependents guard excluding the edge's endpoint). Freeze from any bystander
   still blocks.

## Consequences

- The porcelain loop works on real trees: `set`/`done` on parented and blocked workitems succeed;
  completing a frozen epic/masterplan succeeds; meaning-edits on depended-upon nodes are refused
  with the supersession pointer, as designed.
- For symmetric trees, freeze now largely subsumes the dependents guard (a node with children is
  both frozen and dependents-blocked). The dependents guard is retained: it independently catches
  one-sided drift and carries the more specific blast-radius message.
- A superseded node remains frozen exactly as before (this direction was already correct).
- The slice-2 memory/refinement "a parent freezes its children" is reversed; freeze.unit.ts,
  mutate.unit.ts, and work.unit.ts encode the new direction.
