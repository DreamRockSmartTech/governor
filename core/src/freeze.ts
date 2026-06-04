/**
 * Frozen-mandate detection and enforcement (design of record, control 1).
 *
 * A node is **frozen** the moment another node points a *structural* edge at it
 * — freeze is derived from the graph, never a declared flag, so it cannot drift.
 * A frozen node's body and frontmatter are immutable at HEAD; to change its
 * meaning you supersede it. Walk-back is `git reset` (out of band).
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

/**
 * The structural edge kinds that *freeze their target* — the dependency-creating
 * direction. A parent freezes its `children`, a blocker `blocks` (freezes) the
 * blocked, a superseder `supersedes` (freezes) the superseded. The reverse kinds
 * (`parent`/`blocked_by`/`superseded_by`) describe the same relationship from
 * the dependent's side and do not freeze. This is the same dependent direction
 * the blast-radius traversal walks.
 */
const FREEZING_KINDS = new Set(["children", "blocks", "supersedes"]);

/** Whether a node is frozen, and which nodes' structural edges froze it. */
export interface FreezeState {
  frozen: boolean;
  /** The ids of nodes holding an inbound freezing edge to this node. */
  frozenBy: string[];
}

/**
 * Compute the freeze state of `nodeId`: frozen iff some other node holds a
 * freezing structural edge pointing at it. `frozenBy` lists those nodes
 * (deduped, sorted).
 */
export function freezeState(graph: Graph, nodeId: string, _taxonomy: Taxonomy): FreezeState {
  const sources = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.to !== nodeId || edge.from === nodeId) continue;
    if (!FREEZING_KINDS.has(edge.kind)) continue;
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
 */
export function guardMutation(
  graph: Graph,
  nodeId: string,
  taxonomy: Taxonomy,
): ValidationFinding | null {
  const state = freezeState(graph, nodeId, taxonomy);
  if (!state.frozen) return null;
  return {
    severity: "error",
    code: "frozen-node",
    nodeId,
    message:
      `"${nodeId}" is frozen by inbound structural edge(s) from ${state.frozenBy.join(", ")}; ` +
      `supersede it with a new node instead of editing it`,
  };
}
