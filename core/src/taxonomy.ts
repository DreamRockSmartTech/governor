/**
 * The Governor taxonomy: the vocabulary of node types, their valid status
 * enums, and the edge kinds (with their structural reverses) that wire the
 * graph together.
 *
 * Governor ships a sensible default taxonomy ({@link DEFAULT_TAXONOMY}) but is
 * portable: a repo may supply an override map that merges/extends the defaults
 * (per the design of record, control 3). The merge helper here is the seam for
 * that — narrowing semantics (whether an override may remove a default state)
 * are deliberately deferred and the merge currently only extends.
 *
 * @module
 */

/**
 * Definition of one structural edge kind. `reverse` names the edge written on
 * the target node so the relationship is bidirectional; a `null` reverse marks
 * a one-way (weak) edge such as `cites`, whose reverse is computed in-memory but
 * never required on the target.
 */
export interface EdgeKind {
  /** The declared edge name, e.g. `"parent"`. */
  name: string;
  /** The reverse edge written on the target, or `null` for a one-way edge. */
  reverse: string | null;
  /**
   * True when this edge participates in structural integrity (symmetry is
   * enforced, blast radius is blocking). One-way weak edges are non-structural.
   */
  structural: boolean;
}

/** The full taxonomy: node types, per-type status enums, edges, and aliases. */
export interface Taxonomy {
  /** Allowed `node_type` values. */
  nodeTypes: readonly string[];
  /** Allowed `status` values per node type. */
  statusByType: Readonly<Record<string, readonly string[]>>;
  /** Edge kinds keyed by their declared name. */
  edges: Readonly<Record<string, EdgeKind>>;
  /**
   * Maps an `id` prefix to the canonical `node_type` it stands for, when they
   * differ. Example: the project root is `charter-h3g` but `node_type: project`.
   */
  idPrefixAliases: Readonly<Record<string, string>>;
}

/** Edge kinds shipped by default. */
const DEFAULT_EDGES: Record<string, EdgeKind> = {
  parent: { name: "parent", reverse: "children", structural: true },
  children: { name: "children", reverse: "parent", structural: true },
  blocks: { name: "blocks", reverse: "blocked_by", structural: true },
  blocked_by: { name: "blocked_by", reverse: "blocks", structural: true },
  supersedes: { name: "supersedes", reverse: "superseded_by", structural: true },
  superseded_by: { name: "superseded_by", reverse: "supersedes", structural: true },
  cites: { name: "cites", reverse: null, structural: false },
};

/**
 * The default Governor taxonomy, derived from the reference `.governance/` tree.
 * Node types span the standard ladder (project → masterplan → epic → … →
 * workitem) plus the orthogonal `decision` record layer, `gate` checkpoints, and
 * the generated `index` view.
 */
export const DEFAULT_TAXONOMY: Taxonomy = {
  nodeTypes: ["project", "masterplan", "epic", "gate", "decision", "workitem", "index"],
  statusByType: {
    project: ["active", "archived"],
    masterplan: ["open", "complete", "partial", "closed", "superseded"],
    epic: ["open", "complete", "partial", "closed", "superseded"],
    workitem: ["open", "complete", "partial", "closed", "superseded"],
    gate: ["open", "partial", "cleared", "failed"],
    decision: ["accepted", "superseded"],
    index: ["active"],
  },
  edges: DEFAULT_EDGES,
  idPrefixAliases: {
    charter: "project",
    governance: "index",
  },
};

/**
 * Resolve the canonical node type an `id` prefix stands for, applying
 * {@link Taxonomy.idPrefixAliases}. Returns the prefix unchanged when no alias
 * applies.
 */
export function resolvePrefix(prefix: string, taxonomy: Taxonomy): string {
  return taxonomy.idPrefixAliases[prefix] ?? prefix;
}

/**
 * Merge a partial repo override onto a base taxonomy, extending node types,
 * per-type status enums, edges, and aliases. This is the portability seam
 * (control 3); it only ever extends — narrowing/removal semantics are TBD.
 */
export function mergeTaxonomy(base: Taxonomy, override: Partial<Taxonomy>): Taxonomy {
  return {
    nodeTypes: [...new Set([...base.nodeTypes, ...(override.nodeTypes ?? [])])],
    statusByType: mergeStatusMaps(base.statusByType, override.statusByType ?? {}),
    edges: { ...base.edges, ...(override.edges ?? {}) },
    idPrefixAliases: { ...base.idPrefixAliases, ...(override.idPrefixAliases ?? {}) },
  };
}

/** Union the status arrays of two per-type status maps. */
function mergeStatusMaps(
  base: Readonly<Record<string, readonly string[]>>,
  override: Readonly<Record<string, readonly string[]>>,
): Record<string, readonly string[]> {
  const merged: Record<string, readonly string[]> = { ...base };
  for (const [type, statuses] of Object.entries(override)) {
    merged[type] = [...new Set([...(base[type] ?? []), ...statuses])];
  }
  return merged;
}
