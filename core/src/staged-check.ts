/**
 * Staged-snapshot boundary rules — the out-of-band enforcement teeth for
 * controls 1 and 5.
 *
 * The CLI write path *prevents* illegal mutations, but a hand edit bypasses it.
 * The standalone validator catches asymmetric drift, yet two cases slip a
 * snapshot-only check: an edit to a frozen node, and a *symmetric* hand-made
 * structural change (both sides edited consistently). Both are only visible by
 * comparing the staged tree against HEAD — which is what this module does,
 * purely: the caller materializes both graphs (from git), this module judges
 * the delta.
 *
 * The rules mirror the CLI's own legality exactly, so anything the CLI would
 * have produced passes:
 * - `status` changes are workflow-exempt (ADR-0002).
 * - Edge additions pass as reconciliation (the counterparty declared the
 *   reverse at HEAD) or new-node wiring (the counterparty is a new staged node
 *   declaring the reverse — the `governor new` path).
 * - A symmetric edge-pair add/remove between existing nodes passes iff at
 *   least one direction would have been a legal `governor edge` call (freeze
 *   with counterparty exclusion + dependents guard, judged at HEAD).
 * - Everything else on a frozen node — body, plain fields, one-sided edge
 *   edits, deletion — is blocked: supersede instead.
 * - A `criteria_check` change is blocked on a gate that is frozen or has
 *   dependents (the blocking blast-radius case of control 4).
 *
 * @module
 */

import type { Taxonomy } from "./taxonomy.ts";
import { blastRadius } from "./graph.ts";
import { freezeState } from "./freeze.ts";
import type { GovNode, Graph, ValidationFinding } from "./types.ts";

/**
 * Judge the staged tree's delta against HEAD. Returns `error` findings for
 * every out-of-band change; an empty result means the delta is something the
 * CLI write path could have produced. Pure — graphs in, findings out.
 */
export function stagedBoundary(
  head: Graph,
  staged: Graph,
  taxonomy: Taxonomy,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const [id, headNode] of head.byId) {
    const frozenBy = freezeState(head, id, taxonomy).frozenBy;
    const stagedNode = staged.byId.get(id);

    if (!stagedNode) {
      if (frozenBy.length > 0) {
        findings.push(err(
          "frozen-node-deleted",
          id,
          `"${id}" is frozen (relied on by ${frozenBy.join(", ")}) and cannot be deleted; ` +
            `supersede it instead`,
        ));
      }
      continue;
    }

    if (headNode.body !== stagedNode.body && frozenBy.length > 0) {
      findings.push(err(
        "frozen-body-edit",
        id,
        `"${id}" is frozen (relied on by ${frozenBy.join(", ")}); its prose body cannot ` +
          `change — supersede it instead`,
      ));
    }

    diffFrontmatter(head, staged, headNode, stagedNode, frozenBy, taxonomy, findings);
  }

  return findings;
}

/** Compare one node's frontmatter across HEAD and staged, key by key. */
function diffFrontmatter(
  head: Graph,
  staged: Graph,
  headNode: GovNode,
  stagedNode: GovNode,
  frozenBy: string[],
  taxonomy: Taxonomy,
  out: ValidationFinding[],
): void {
  const keys = new Set([
    ...Object.keys(headNode.frontmatter),
    ...Object.keys(stagedNode.frontmatter),
  ]);

  for (const key of keys) {
    const before = headNode.frontmatter[key];
    const after = stagedNode.frontmatter[key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    if (key === "status") continue; // workflow-exempt (ADR-0002)

    if (key in taxonomy.edges) {
      diffEdgeField(head, staged, headNode.id, key, before, after, frozenBy, taxonomy, out);
      continue;
    }

    if (key === "criteria_check") {
      const dependents = blastRadius(head, headNode.id, "structural", taxonomy);
      if (frozenBy.length > 0 || dependents.length > 0) {
        out.push(err(
          "out-of-band-structural",
          headNode.id,
          `criteria_check on "${headNode.id}" changed while ` +
            `[${[...new Set([...frozenBy, ...dependents])].join(", ")}] rely on it; ` +
            `supersede the gate instead`,
        ));
      }
      continue;
    }

    if (frozenBy.length > 0) {
      out.push(err(
        "frozen-node-edited",
        headNode.id,
        `"${headNode.id}" is frozen (relied on by ${frozenBy.join(", ")}); field "${key}" ` +
          `cannot change — supersede the node instead`,
      ));
    }
  }
}

/** Judge added/removed values of one edge field on one node. */
function diffEdgeField(
  head: Graph,
  staged: Graph,
  id: string,
  kind: string,
  before: unknown,
  after: unknown,
  frozenBy: string[],
  taxonomy: Taxonomy,
  out: ValidationFinding[],
): void {
  const headTargets = asList(before);
  const stagedTargets = asList(after);
  const reverse = taxonomy.edges[kind]?.reverse ?? null;

  for (const target of stagedTargets.filter((t) => !headTargets.includes(t))) {
    if (addedEdgeIsLegal(head, staged, id, kind, reverse, target, taxonomy)) continue;
    out.push(outOfBand(id, `added ${kind} -> "${target}"`, frozenBy));
  }

  for (const target of headTargets.filter((t) => !stagedTargets.includes(t))) {
    if (removedEdgeIsLegal(head, staged, id, kind, reverse, target, taxonomy)) continue;
    out.push(outOfBand(id, `removed ${kind} -> "${target}"`, frozenBy));
  }
}

/**
 * An added edge value is legal when it is (a) reconciliation — the counterparty
 * already declared the reverse at HEAD; (b) new-node wiring — the counterparty
 * is a new staged node declaring the reverse (the creation path writes the
 * parent side without a guard); or (c) a symmetric pair add that at least one
 * direction of `governor edge add` could have performed; or (d) any change on
 * an unfrozen node (one-sided drift is the symmetric validator's finding, not
 * a boundary violation).
 */
function addedEdgeIsLegal(
  head: Graph,
  staged: Graph,
  id: string,
  kind: string,
  reverse: string | null,
  target: string,
  taxonomy: Taxonomy,
): boolean {
  const frozen = freezeState(head, id, taxonomy).frozenBy.length > 0;
  if (!reverse) return !frozen; // weak one-way edge: only freeze constrains it

  const declaredAtHead = asList(head.byId.get(target)?.frontmatter[reverse]).includes(id);
  if (declaredAtHead) return true; // (a) reconciliation backfill

  const stagedTarget = staged.byId.get(target);
  const declaresReverse = asList(stagedTarget?.frontmatter[reverse]).includes(id);
  if (!head.byId.has(target) && declaresReverse) return true; // (b) new-node wiring

  if (declaresReverse) {
    // (c) symmetric pair between existing nodes — mirror `edge add` legality.
    return cliEdgeLegal(head, id, target, taxonomy) || cliEdgeLegal(head, target, id, taxonomy);
  }

  return !frozen; // (d) one-sided: asymmetry is the validator's finding
}

/**
 * A removed edge value is legal when the pair was dissolved and at least one
 * direction of `governor edge rm` could have performed it (freeze and
 * dependents judged at HEAD, the counterparty excluded). A one-sided removal
 * on an unfrozen node is left to the symmetric validator.
 */
function removedEdgeIsLegal(
  head: Graph,
  staged: Graph,
  id: string,
  kind: string,
  reverse: string | null,
  target: string,
  taxonomy: Taxonomy,
): boolean {
  const frozen = freezeState(head, id, taxonomy).frozenBy.length > 0;
  if (!reverse) return !frozen;

  const stillDeclared = asList(staged.byId.get(target)?.frontmatter[reverse]).includes(id);
  if (!stillDeclared) {
    return cliEdgeLegal(head, id, target, taxonomy) || cliEdgeLegal(head, target, id, taxonomy);
  }

  return !frozen;
}

/**
 * Whether `governor edge add|rm from ... to` would have been allowed at HEAD:
 * `from` is not frozen by anyone but `to`, and has no dependents besides `to`
 * (the CLI's counterparty exclusion on both guards).
 */
function cliEdgeLegal(head: Graph, from: string, to: string, taxonomy: Taxonomy): boolean {
  const frozenBy = freezeState(head, from, taxonomy).frozenBy.filter((n) => n !== to);
  if (frozenBy.length > 0) return false;
  const dependents = blastRadius(head, from, "structural", taxonomy).filter((n) => n !== to);
  return dependents.length === 0;
}

/** Normalize a frontmatter edge value to a string list. */
function asList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function outOfBand(id: string, what: string, frozenBy: string[]): ValidationFinding {
  const relied = frozenBy.length > 0 ? ` (frozen — relied on by ${frozenBy.join(", ")})` : "";
  return err(
    "out-of-band-structural",
    id,
    `structural change on "${id}"${relied}: ${what} could not have been made through the CLI; ` +
      `use \`governor edge\` or supersede the node`,
  );
}

function err(code: string, nodeId: string, message: string): ValidationFinding {
  return { severity: "error", code, nodeId, message };
}
