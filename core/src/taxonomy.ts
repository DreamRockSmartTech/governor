/**
 * The Governor taxonomy: the vocabulary of node types, their valid status
 * enums, and the edge kinds (with their structural reverses) that wire the
 * graph together.
 *
 * Governor ships a sensible default taxonomy ({@link DEFAULT_TAXONOMY}) but is
 * portable: a repo may supply an override map in `.governance/taxonomy.json`
 * that merges/extends the defaults (per the design of record, control 3).
 * {@link loadTaxonomy} reads and applies it; {@link mergeTaxonomy} is the pure
 * merge seam — narrowing semantics (whether an override may remove a default
 * state) are deliberately deferred and the merge currently only extends.
 *
 * @module
 */

import { join } from "@std/path";

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
  /**
   * True when an inbound edge of this kind freezes its target — the
   * reliance-declaring direction (control 1, ADR-0002). Declaring `parent`
   * freezes the parent; `blocked_by` freezes the blocker; `supersedes` freezes
   * the superseded record.
   */
  freezes: boolean;
  /**
   * True when this kind points from a node to one of its dependents — the
   * direction the blast-radius traversal walks (control 4). `children`,
   * `blocks`, and `supersedes` point downstream.
   */
  toDependent: boolean;
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
  parent: {
    name: "parent",
    reverse: "children",
    structural: true,
    freezes: true,
    toDependent: false,
  },
  children: {
    name: "children",
    reverse: "parent",
    structural: true,
    freezes: false,
    toDependent: true,
  },
  blocks: {
    name: "blocks",
    reverse: "blocked_by",
    structural: true,
    freezes: false,
    toDependent: true,
  },
  blocked_by: {
    name: "blocked_by",
    reverse: "blocks",
    structural: true,
    freezes: true,
    toDependent: false,
  },
  // `supersedes` both freezes its target (the superseded historical record) and
  // points downstream (the superseded node is reachable from its superseder).
  supersedes: {
    name: "supersedes",
    reverse: "superseded_by",
    structural: true,
    freezes: true,
    toDependent: true,
  },
  superseded_by: {
    name: "superseded_by",
    reverse: "supersedes",
    structural: true,
    freezes: false,
    toDependent: false,
  },
  // The gate-binding pair: an epic/workitem produces its proof-of-done gate;
  // the gate is guarded_by the node it proves. The gate's meaning derives from
  // its producer (so `guarded_by` freezes the producer, like `parent`), but the
  // gate itself stays unfrozen — its status is machine-owned by the runner and
  // its `partial` bypass must remain human-settable.
  produces_gate: {
    name: "produces_gate",
    reverse: "guarded_by",
    structural: true,
    freezes: false,
    toDependent: true,
  },
  guarded_by: {
    name: "guarded_by",
    reverse: "produces_gate",
    structural: true,
    freezes: true,
    toDependent: false,
  },
  // Weak one-way references: recognized so dangling targets are caught, but no
  // reverse is required and they carry no freeze/blast-radius semantics.
  consumes_gate: {
    name: "consumes_gate",
    reverse: null,
    structural: false,
    freezes: false,
    toDependent: false,
  },
  decisions: {
    name: "decisions",
    reverse: null,
    structural: false,
    freezes: false,
    toDependent: false,
  },
  cited_by: {
    name: "cited_by",
    reverse: null,
    structural: false,
    freezes: false,
    toDependent: false,
  },
  gates: { name: "gates", reverse: null, structural: false, freezes: false, toDependent: false },
  cites: { name: "cites", reverse: null, structural: false, freezes: false, toDependent: false },
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
 * Frontmatter keys that carry *structural* meaning — graph edges plus
 * `criteria_check`. Mutating these is the blocking case (control 4) and must go
 * through the dedicated `edge`/`gate` paths, never a plain field `set`. This is
 * the single source of truth for the structural/plain field split.
 */
export function isStructuralField(field: string, taxonomy: Taxonomy): boolean {
  return field === "criteria_check" || field in taxonomy.edges;
}

/** The reserved `status` field is owned by the status/gate-runner paths. */
export function isStatusField(field: string): boolean {
  return field === "status";
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

/** The repo taxonomy-override file, relative to the `.governance/` root. */
export const TAXONOMY_FILE = "taxonomy.json";

/**
 * Load the effective taxonomy for a `.governance/` root: the shipped
 * {@link DEFAULT_TAXONOMY}, extended by the repo's optional
 * `taxonomy.json` override (control 3's portability seam). Edge entries in the
 * override may be partial — `name` is taken from the key and omitted flags
 * default off. A missing file yields the defaults; a malformed file is an
 * error (the override is authority-bearing, so silent fallback would hide a
 * misconfiguration).
 */
export async function loadTaxonomy(root: string): Promise<Taxonomy> {
  const path = join(root, TAXONOMY_FILE);
  let raw: string;
  try {
    raw = await Deno.readTextFile(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return DEFAULT_TAXONOMY;
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${TAXONOMY_FILE}: not valid JSON — ${(err as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${TAXONOMY_FILE}: expected a JSON object of taxonomy overrides`);
  }

  return mergeTaxonomy(DEFAULT_TAXONOMY, normalizeOverride(parsed as Record<string, unknown>));
}

/** Normalize a parsed override: fill partial edge entries with defaults. */
function normalizeOverride(parsed: Record<string, unknown>): Partial<Taxonomy> {
  const override: Partial<Taxonomy> = {
    nodeTypes: parsed.nodeTypes as string[] | undefined,
    statusByType: parsed.statusByType as Record<string, string[]> | undefined,
    idPrefixAliases: parsed.idPrefixAliases as Record<string, string> | undefined,
  };

  if (typeof parsed.edges === "object" && parsed.edges !== null) {
    const edges: Record<string, EdgeKind> = {};
    for (const [name, value] of Object.entries(parsed.edges as Record<string, unknown>)) {
      const entry = (typeof value === "object" && value !== null ? value : {}) as Partial<EdgeKind>;
      edges[name] = {
        name,
        reverse: entry.reverse ?? null,
        structural: entry.structural ?? false,
        freezes: entry.freezes ?? false,
        toDependent: entry.toDependent ?? false,
      };
    }
    override.edges = edges;
  }

  return override;
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
