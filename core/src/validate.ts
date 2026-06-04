/**
 * The single validation core (design of record, control 3).
 *
 * One function, two entry points: the CLI write path calls it before every
 * write (prevent), and the standalone `governor check` runs it over a whole tree
 * (catch anything that bypassed the CLI). This module is the latter's engine.
 *
 * It checks schema/grammar (id grammar, node type, status enum, uid, monotonic
 * `{NN}` uniqueness) and graph integrity (edge symmetry, dangling edges). Schema
 * problems and broken structure are `error`; cosmetic issues are `warn`.
 *
 * @module
 */

import { resolvePrefix, type Taxonomy } from "./taxonomy.ts";
import type { Edge, GovNode, Graph, ValidationFinding } from "./types.ts";

/** Numbered id grammar: `{prefix}-{NN}-{slug}` (NN ≥ 1 digit, slug kebab). */
const NUMBERED_ID_RE = /^([a-z]+)-(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
/** Root id grammar for singleton aliased nodes: `{prefix}-{slug}` (no number). */
const ROOT_ID_RE = /^([a-z]+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
/** RFC-4122 UUID shape. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Node types addressed by a root (un-numbered) id. */
const ROOT_TYPES = new Set(["project", "index"]);

/**
 * Validate a built {@link Graph} against a {@link Taxonomy}. Returns every
 * finding; the caller decides exit behavior (any `error` ⇒ non-zero). Pure.
 */
export function validate(graph: Graph, taxonomy: Taxonomy): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const nodes = [...graph.byId.values()];

  checkSchema(nodes, taxonomy, findings);
  checkUniqueness(nodes, findings);
  checkIntegrity(graph, taxonomy, findings);

  return findings;
}

/** Per-node schema/grammar checks (id grammar, type, status, uid). */
function checkSchema(nodes: GovNode[], taxonomy: Taxonomy, out: ValidationFinding[]): void {
  for (const node of nodes) {
    if (!taxonomy.nodeTypes.includes(node.nodeType)) {
      out.push(
        err("unknown-node-type", node.id, `node_type "${node.nodeType}" is not in the taxonomy`),
      );
    }

    checkId(node, taxonomy, out);
    checkStatus(node, taxonomy, out);
    checkUid(node, out);
  }
}

/** Validate the id grammar and that its prefix agrees with the node type. */
function checkId(node: GovNode, taxonomy: Taxonomy, out: ValidationFinding[]): void {
  const numbered = node.id.match(NUMBERED_ID_RE);
  const root = node.id.match(ROOT_ID_RE);

  // Root (un-numbered) form is only valid for singleton root types.
  if (!numbered && root && ROOT_TYPES.has(node.nodeType)) {
    assertPrefix(root[1], node, taxonomy, out);
    return;
  }
  if (!numbered) {
    out.push(err("malformed-id", node.id, `id "${node.id}" does not match {type}-{NN}-{slug}`));
    return;
  }
  assertPrefix(numbered[1], node, taxonomy, out);
}

/** The id prefix, resolved through aliases, must equal the node type. */
function assertPrefix(
  prefix: string,
  node: GovNode,
  taxonomy: Taxonomy,
  out: ValidationFinding[],
): void {
  if (resolvePrefix(prefix, taxonomy) !== node.nodeType) {
    out.push(err(
      "id-prefix-mismatch",
      node.id,
      `id prefix "${prefix}" does not resolve to node_type "${node.nodeType}"`,
    ));
  }
}

/** The status must be in the taxonomy's enum for this node type. */
function checkStatus(node: GovNode, taxonomy: Taxonomy, out: ValidationFinding[]): void {
  const allowed = taxonomy.statusByType[node.nodeType];
  const status = node.frontmatter.status;
  if (!allowed) return; // unknown type already reported
  if (typeof status !== "string" || !allowed.includes(status)) {
    out.push(
      err(
        "invalid-status",
        node.id,
        `status "${String(status)}" is not valid for ${node.nodeType}`,
      ),
    );
  }
}

/** Every node must carry a well-formed uid. */
function checkUid(node: GovNode, out: ValidationFinding[]): void {
  if (!UUID_RE.test(node.uid)) {
    out.push(err("invalid-uid", node.id, `uid "${node.uid}" is missing or not a UUID`));
  }
}

/** Uniqueness of uid (global) and `{NN}` (per node type). */
function checkUniqueness(nodes: GovNode[], out: ValidationFinding[]): void {
  const seenUid = new Map<string, string>();
  const seenNumber = new Map<string, string>(); // `${type}-${NN}` -> id

  for (const node of nodes) {
    if (node.uid) {
      const prior = seenUid.get(node.uid);
      if (prior) out.push(err("duplicate-uid", node.id, `uid collides with ${prior}`));
      else seenUid.set(node.uid, node.id);
    }

    const numbered = node.id.match(NUMBERED_ID_RE);
    if (!numbered) continue;
    const key = `${node.nodeType}-${Number(numbered[2])}`;
    const prior = seenNumber.get(key);
    if (prior) out.push(err("duplicate-number", node.id, `{NN} collides with ${prior}`));
    else seenNumber.set(key, node.id);
  }
}

/** Edge integrity: targets resolve, and structural edges are symmetric. */
function checkIntegrity(graph: Graph, taxonomy: Taxonomy, out: ValidationFinding[]): void {
  for (const edge of graph.edges) {
    if (edge.derived) {
      reportAsymmetry(edge, taxonomy, out);
      continue;
    }
    if (!graph.byId.has(edge.to)) {
      out.push(err("dangling-edge", edge.from, `${edge.kind} -> "${edge.to}" resolves to no node`));
    }
  }
}

/**
 * A derived edge whose target exists means the target failed to declare its
 * half of a structural relationship — hand-edit drift. (A derived edge to a
 * missing target is already covered as a dangling edge on the declared side.)
 */
function reportAsymmetry(edge: Edge, taxonomy: Taxonomy, out: ValidationFinding[]): void {
  if (!taxonomy.edges[edge.kind]?.structural) return;
  // `from` is the node that should have declared the reverse `kind`.
  out.push(err(
    "asymmetric-edge",
    edge.from,
    `missing declared "${edge.kind}" -> "${edge.to}" (reverse exists on the other side)`,
  ));
}

/** Construct an `error` finding. */
function err(code: string, nodeId: string, message: string): ValidationFinding {
  return { severity: "error", code, nodeId, message };
}
