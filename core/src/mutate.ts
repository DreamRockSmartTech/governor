/**
 * Pure graph-mutation helpers — the engine behind the CLI write path (design of
 * record, control 5). Each helper returns the new {@link GovNode}(s) to persist
 * and performs no I/O; the frontend writes them. Every mutation enforces the
 * shared invariants before returning:
 *
 * - **Freeze** (control 1): a frozen node cannot be edited → supersede instead.
 * - **Write-time validation** (control 3): the resulting graph must pass the one
 *   validation core, so the CLI is the "prevent" entry point.
 * - **Symmetry** (control 4): edge changes write both sides.
 * - **Blocking blast-radius** (control 4): a structural change on a node that
 *   has dependents is refused and routed to supersession.
 *
 * Field/status concerns are split one-per-command: `setField` handles plain
 * scalars, `addEdge`/`removeEdge` handle structural edges, `transitionStatus`
 * handles work/plan status (gates are machine-owned by the runner).
 *
 * @module
 */

import { isStatusField, isStructuralField, type Taxonomy } from "./taxonomy.ts";
import { asList } from "./fields.ts";
import { blastRadius, buildGraph } from "./graph.ts";
import { guardMutation } from "./freeze.ts";
import { validate } from "./validate.ts";
import type { GovNode, Graph } from "./types.ts";

/** Thrown when a mutation violates an invariant (freeze, schema, structure). */
export class MutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MutationError";
  }
}

/** Specification for a new node passed to {@link createNode}. */
export interface NewNodeSpec {
  nodeType: string;
  /** The allocated `{NN}` (the caller allocates via the counter file). */
  nn: number;
  title: string;
  /** Stewardship identity (committer's git `user.email`); omitted if absent. */
  owner?: string;
  /** Declared edges, e.g. `{ parent: "masterplan-01-x" }` (one target each). */
  edges?: Record<string, string>;
  taxonomy: Taxonomy;
}

/** Result of a creation: the new node plus any edited edge-target nodes. */
export interface CreateResult {
  node: GovNode;
  /** Existing nodes whose reverse edges were updated. */
  updated: GovNode[];
}

/**
 * Create a node: build ordered, valid frontmatter (id, uid, status), wire the
 * reverse of each declared edge onto its target, and validate the resulting
 * graph. Returns the new node and the edited targets to persist.
 */
export function createNode(graph: Graph, spec: NewNodeSpec): CreateResult {
  const { nodeType, nn, title, taxonomy } = spec;
  const id = `${nodeType}-${pad(nn)}-${slugify(title)}`;
  const edges = spec.edges ?? {};

  const frontmatter: Record<string, unknown> = {
    uid: crypto.randomUUID(),
    id,
    node_type: nodeType,
    status: defaultStatus(nodeType, taxonomy),
    title,
    ...(spec.owner ? { owner: spec.owner } : {}),
    ...edges,
  };
  const node: GovNode = {
    id,
    uid: frontmatter.uid as string,
    nodeType,
    frontmatter,
    body: "",
    path: "",
  };

  // Wire the reverse edge onto each declared target.
  const updated: GovNode[] = [];
  for (const [kind, target] of Object.entries(edges)) {
    const reverse = taxonomy.edges[kind]?.reverse;
    if (!reverse) continue;
    const targetNode = requireNode(graph, target, kind);
    updated.push(appendEdge(targetNode, reverse, id));
  }

  revalidate(graph, [node, ...updated], taxonomy);
  return { node, updated };
}

/**
 * Update a plain (non-structural, non-status) scalar field. Rejects structural
 * and status fields with a pointer to the right command, refuses frozen nodes,
 * and validates the result.
 */
export function setField(
  graph: Graph,
  nodeId: string,
  field: string,
  value: string,
  taxonomy: Taxonomy,
): GovNode {
  if (isStructuralField(field, taxonomy)) {
    throw new MutationError(`"${field}" is a structural field — use \`governor edge\` instead`);
  }
  if (isStatusField(field)) {
    throw new MutationError(`status is owned by \`governor status\` (or \`gate run\` for gates)`);
  }
  guard(graph, nodeId, taxonomy);

  const node = requireNode(graph, nodeId, "set");
  const updated = withFrontmatter(node, { ...node.frontmatter, [field]: value });
  revalidate(graph, [updated], taxonomy);
  return updated;
}

/**
 * Add a structural edge `from --kind--> to`, writing both sides. Blocks when the
 * source already has dependents (non-empty blast radius), routing to
 * supersession.
 *
 * Freeze is enforced for genuinely new edges, but **exempted for symmetry
 * reconciliation** — when this edge only backfills the reverse of an edge
 * already declared on `to`. Reconciliation changes no meaning (the relationship
 * already exists from the other side); blocking it would make pre-existing drift
 * unfixable on a frozen node.
 */
export function addEdge(
  graph: Graph,
  from: string,
  kind: string,
  to: string,
  taxonomy: Taxonomy,
): GovNode[] {
  const reverse = requireEdgeKind(kind, taxonomy);
  const fromNode = requireNode(graph, from, "edge");
  const toNode = requireNode(graph, to, "edge");
  // Pure symmetry reconciliation changes no meaning, so it is exempt from both
  // the freeze guard and the dependents-block guard.
  if (!isReconciliation(toNode, reverse, from)) {
    guard(graph, from, taxonomy, to);
    blockIfDependents(graph, from, kind, to, taxonomy);
  }

  const updated = [appendEdge(fromNode, kind, to)];
  if (reverse) updated.push(appendEdge(toNode, reverse, from));
  revalidate(graph, updated, taxonomy);
  return updated;
}

/**
 * Whether adding `from --kind--> to` merely completes an existing relationship:
 * `to` already declares the reverse edge back to `from`. Such a write is pure
 * symmetry bookkeeping, exempt from freeze.
 */
function isReconciliation(toNode: GovNode, reverse: string | null, from: string): boolean {
  if (!reverse) return false;
  return asList(toNode.frontmatter[reverse]).includes(from);
}

/** Remove a structural edge `from --kind--> to` from both sides. */
export function removeEdge(
  graph: Graph,
  from: string,
  kind: string,
  to: string,
  taxonomy: Taxonomy,
): GovNode[] {
  const reverse = requireEdgeKind(kind, taxonomy);
  const fromNode = requireNode(graph, from, "edge");
  const toNode = requireNode(graph, to, "edge");
  guard(graph, from, taxonomy, to);
  blockIfDependents(graph, from, kind, to, taxonomy);

  const updated = [dropEdge(fromNode, kind, to)];
  if (reverse) updated.push(dropEdge(toNode, reverse, from));
  revalidate(graph, updated, taxonomy);
  return updated;
}

/**
 * Transition a work/plan node's status. Enforces the type's status enum.
 * Refuses gate nodes — gate status is machine-owned by the gate runner.
 *
 * Status is deliberately exempt from the freeze guard (ADR-0002): freeze locks
 * a node's *meaning* (title, prose, plain fields, edges); status is workflow
 * state — a frozen epic must still be completable when its children are done.
 */
export function transitionStatus(
  graph: Graph,
  nodeId: string,
  newStatus: string,
  taxonomy: Taxonomy,
): GovNode {
  const node = requireNode(graph, nodeId, "status");
  if (node.nodeType === "gate") {
    throw new MutationError(`gate status is machine-owned — use \`governor gate run ${nodeId}\``);
  }
  const allowed = taxonomy.statusByType[node.nodeType] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new MutationError(
      `status "${newStatus}" is not valid for ${node.nodeType} (allowed: ${allowed.join(", ")})`,
    );
  }

  const updated = withFrontmatter(node, { ...node.frontmatter, status: newStatus });
  revalidate(graph, [updated], taxonomy);
  return updated;
}

// ---- internals -------------------------------------------------------------

/** Throw if `nodeId` is frozen (optionally ignoring freeze from `ignoring`). */
function guard(graph: Graph, nodeId: string, taxonomy: Taxonomy, ignoring?: string): void {
  const finding = guardMutation(graph, nodeId, taxonomy, ignoring);
  if (finding) throw new MutationError(finding.message);
}

/**
 * Throw if a structural change on `from` would affect existing dependents. The
 * edge's own endpoint `to` is excluded — it is the relationship being changed,
 * not a bystander relying on it (otherwise removing an edge could never proceed).
 */
function blockIfDependents(
  graph: Graph,
  from: string,
  kind: string,
  to: string,
  taxonomy: Taxonomy,
): void {
  const dependents = blastRadius(graph, from, "structural", taxonomy).filter((id) => id !== to);
  if (dependents.length > 0) {
    throw new MutationError(
      `structural change (${kind} -> ${to}) on "${from}" is blocked: it has dependents ` +
        `[${dependents.join(", ")}]; supersede "${from}" instead`,
    );
  }
}

/** Look up a node or throw a mutation error naming the command context. */
function requireNode(graph: Graph, id: string, ctx: string): GovNode {
  const node = graph.byId.get(id);
  if (!node) throw new MutationError(`${ctx}: no node with id "${id}"`);
  return node;
}

/** Validate that `kind` is a known edge; return its reverse (may be null). */
function requireEdgeKind(kind: string, taxonomy: Taxonomy): string | null {
  const edge = taxonomy.edges[kind];
  if (!edge) throw new MutationError(`unknown edge kind "${kind}"`);
  return edge.reverse;
}

/** A copy of `node` with `field`'s list extended by `value` (deduped). */
function appendEdge(node: GovNode, field: string, value: string): GovNode {
  const current = asList(node.frontmatter[field]);
  if (current.includes(value)) return withFrontmatter(node, { ...node.frontmatter });
  return withFrontmatter(node, { ...node.frontmatter, [field]: [...current, value] });
}

/** A copy of `node` with `value` removed from `field`'s list. */
function dropEdge(node: GovNode, field: string, value: string): GovNode {
  const current = asList(node.frontmatter[field]).filter((v) => v !== value);
  const fm = { ...node.frontmatter };
  if (current.length > 0) fm[field] = current;
  else delete fm[field];
  return withFrontmatter(node, fm);
}

/** A copy of `node` carrying a new frontmatter mapping. */
function withFrontmatter(node: GovNode, frontmatter: Record<string, unknown>): GovNode {
  return { ...node, frontmatter };
}

/**
 * Validate that a mutation does not *introduce* new errors. Pre-existing drift
 * elsewhere in the tree is tolerated — otherwise a tree with any prior drift
 * could never be mutated, including to *fix* that drift. Only errors absent
 * before the mutation block it. Findings are compared by `code` + `nodeId`.
 */
function revalidate(graph: Graph, mutated: GovNode[], taxonomy: Taxonomy): void {
  const before = errorKeys(validate(graph, taxonomy));

  const byId = new Map(graph.byId);
  for (const node of mutated) byId.set(node.id, node);
  const next = buildGraph([...byId.values()], taxonomy);
  const after = validate(next, taxonomy).filter((f) => f.severity === "error");

  const introduced = after.filter((f) => !before.has(`${f.code} ${f.nodeId}`));
  if (introduced.length > 0) {
    throw new MutationError(
      `mutation would introduce errors: ${introduced.map((e) => e.message).join("; ")}`,
    );
  }
}

/** Set of `code\0nodeId` keys for the error-severity findings. */
function errorKeys(findings: ReturnType<typeof validate>): Set<string> {
  return new Set(
    findings.filter((f) => f.severity === "error").map((f) => `${f.code} ${f.nodeId}`),
  );
}

/** The default status for a freshly created node of `nodeType`. */
function defaultStatus(nodeType: string, taxonomy: Taxonomy): string {
  const allowed = taxonomy.statusByType[nodeType] ?? [];
  if (allowed.includes("open")) return "open";
  if (allowed.includes("active")) return "active";
  return allowed[0] ?? "open";
}

/** Zero-pad a number to at least two digits (`7` → `"07"`). */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Kebab-case a title for use in an id slug. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
