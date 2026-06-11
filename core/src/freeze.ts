/**
 * Frozen-mandate detection and enforcement (design of record, control 1;
 * direction per ADR-0002).
 *
 * A node is **frozen** the moment another node *relies on it* through a
 * structural edge — freeze is derived from the graph, never a declared flag, so
 * it cannot drift. Freeze protects the **depended-upon** node (the mandate): a
 * parent whose children derive from it, a blocker something waits on, a
 * superseded node serving as historical record. The dependent itself stays
 * editable — it is workflow, not mandate. To change a frozen node's meaning you
 * supersede it. Walk-back is `git reset` (out of band).
 *
 * Two primitives, both pure and frontend-agnostic:
 * - {@link freezeState}/{@link isFrozen} — **detect** (a GUI renders a lock icon
 *   from this; the checker surfaces it).
 * - {@link guardMutation} — **enforce**, composed from detect (the CLI write
 *   path calls this before mutating).
 *
 * @module
 */

import type { Taxonomy } from "./taxonomy.ts";
import type { Graph, ValidationFinding } from "./types.ts";

/** Whether a node is frozen, and which nodes' structural edges froze it. */
export interface FreezeState {
  frozen: boolean;
  /** The ids of nodes holding an inbound freezing edge to this node. */
  frozenBy: string[];
}

/**
 * Compute the freeze state of `nodeId`: frozen iff some other node holds a
 * freezing structural edge pointing at it. Which kinds freeze is the
 * taxonomy's call ({@link EdgeKind.freezes} — the reliance-declaring
 * direction, ADR-0002), so repo-defined edge kinds participate. `frozenBy`
 * lists those nodes (deduped, sorted).
 */
export function freezeState(graph: Graph, nodeId: string, taxonomy: Taxonomy): FreezeState {
  const sources = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.to !== nodeId || edge.from === nodeId) continue;
    if (!taxonomy.edges[edge.kind]?.freezes) continue;
    sources.add(edge.from);
  }
  return { frozen: sources.size > 0, frozenBy: [...sources].sort() };
}

/** Convenience boolean form of {@link freezeState}. */
export function isFrozen(graph: Graph, nodeId: string, taxonomy: Taxonomy): boolean {
  return freezeState(graph, nodeId, taxonomy).frozen;
}

/**
 * Enforce immutability: return a `frozen-node` finding if `nodeId` is frozen,
 * else `null`. The mutation caller treats a non-null result as a hard stop and
 * directs the user to supersede the node instead of editing it.
 *
 * `ignoring` excludes freeze contributed by one node — the counterparty of an
 * edge being changed. Dissolving a relationship is a change *to* that
 * relationship, so the reliance it created must not block its own dissolution
 * (the same principle as the dependents guard excluding the edge's endpoint).
 * Freeze from any bystander still blocks.
 */
export function guardMutation(
  graph: Graph,
  nodeId: string,
  taxonomy: Taxonomy,
  ignoring?: string,
): ValidationFinding | null {
  const state = freezeState(graph, nodeId, taxonomy);
  const frozenBy = state.frozenBy.filter((id) => id !== ignoring);
  if (frozenBy.length === 0) return null;
  return {
    severity: "error",
    code: "frozen-node",
    nodeId,
    message: `"${nodeId}" is frozen by inbound structural edge(s) from ${frozenBy.join(", ")}; ` +
      `supersede it with a new node instead of editing it`,
  };
}
