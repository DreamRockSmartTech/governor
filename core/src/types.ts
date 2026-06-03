/**
 * Core domain types for the Governor node-graph.
 *
 * A governance graph is a set of typed nodes (charters, masterplans, epics,
 * gates, decisions, work items) parsed from markdown files with YAML
 * frontmatter. Edges between nodes live in the frontmatter. These types are the
 * frontend-agnostic vocabulary every Governor frontend speaks.
 *
 * @module
 */

/**
 * A single governance node: its parsed frontmatter, prose body, and the file it
 * came from. `frontmatter` is the raw parsed YAML mapping — the parser holds no
 * schema opinion; the validator does.
 */
export interface GovNode {
  /** Stable, greppable identifier — `{node_type}-{NN}-{slug}`. */
  id: string;
  /** Immutable UUID; survives renames of the `id` slug. */
  uid: string;
  /** The node's type, e.g. `"epic"`. Drives schema and edge rules. */
  nodeType: string;
  /** Raw parsed frontmatter mapping (all keys, untyped). */
  frontmatter: Record<string, unknown>;
  /** The markdown prose body below the frontmatter block. */
  body: string;
  /** Absolute path to the source file. */
  path: string;
}

/**
 * A resolved directed edge between two nodes, carrying the edge kind that
 * produced it (e.g. `"parent"`, `"blocks"`). `derived` is true when the edge
 * was computed as the reverse of a declared edge rather than declared directly.
 */
export interface Edge {
  /** The `id` of the source node. */
  from: string;
  /** The `id` of the target node. */
  to: string;
  /** The edge-kind name, e.g. `"blocks"`. */
  kind: string;
  /** True when this edge is the in-memory reverse of a declared edge. */
  derived: boolean;
}

/** The in-memory governance graph, built fresh per run from the node set. */
export interface Graph {
  /** All nodes, keyed by `id`. */
  byId: Map<string, GovNode>;
  /** All nodes, keyed by `uid`. */
  byUid: Map<string, GovNode>;
  /** Every materialized edge (declared + derived reverses). */
  edges: Edge[];
}

/** Severity of a validation finding. */
export type Severity = "error" | "warn";

/**
 * A single validation finding. `code` is a stable machine identifier (e.g.
 * `"id-prefix-mismatch"`); `message` is the human explanation. `nodeId` is the
 * offending node's `id`, or its file path when the `id` could not be read.
 */
export interface ValidationFinding {
  severity: Severity;
  code: string;
  nodeId: string;
  message: string;
}
