/**
 * `governor check` — the standalone validator entry point.
 *
 * Loads a `.governance/` tree, builds the graph, runs the shared validation core
 * (the same `validate` the future write path calls), prints findings grouped by
 * severity, and exits non-zero iff any `error` was found. `--json` emits the
 * findings as machine-readable JSON — the seam for CI consumption (record
 * stage 2).
 *
 * `--staged` validates the **staged snapshot** instead of the working tree, and
 * additionally judges the staged delta against HEAD with the boundary rules
 * (`stagedBoundary`): frozen-node edits and symmetric out-of-band structural
 * changes are blocked. This is the pre-commit form — the enforcement teeth for
 * controls 1 and 5.
 *
 * @module
 */

import { dirname, relative } from "@std/path";
import {
  buildGraph,
  DEFAULT_TAXONOMY,
  type GovNode,
  type Graph,
  loadGovernance,
  loadTaxonomy,
  lsStaged,
  lsTree,
  nodeFromSource,
  parseTaxonomyOverride,
  showFile,
  stagedBoundary,
  type Taxonomy,
  TAXONOMY_FILE,
  validate,
  type ValidationFinding,
} from "@dreamrock/governor-core";

/** Options for the check command. */
export interface CheckOptions {
  /** Path to the `.governance/` root to validate. */
  root: string;
  /** Emit findings as JSON instead of human-readable text. */
  json: boolean;
  /** Validate the staged snapshot + the HEAD→staged boundary rules. */
  staged: boolean;
}

/** The process exit code for a set of findings: 1 iff any error, else 0. */
export function exitCodeFor(findings: ValidationFinding[]): number {
  return findings.some((f) => f.severity === "error") ? 1 : 0;
}

/**
 * Run the check command. Returns the exit code (the caller owns `Deno.exit`).
 */
export async function runCheck(opts: CheckOptions): Promise<number> {
  const { count, findings } = opts.staged
    ? await checkStaged(opts.root)
    : await checkTree(opts.root);

  if (opts.json) {
    console.log(JSON.stringify(findings, null, 2));
    return exitCodeFor(findings);
  }

  report(count, findings);
  return exitCodeFor(findings);
}

/** Validate the working tree (the default mode). */
async function checkTree(root: string): Promise<{ count: number; findings: ValidationFinding[] }> {
  const nodes = await loadGovernance(root);
  const taxonomy = await loadTaxonomy(root);
  const graph = buildGraph(nodes, taxonomy);
  return { count: nodes.length, findings: validate(graph, taxonomy) };
}

/**
 * Validate the staged snapshot and judge its delta against HEAD. Both trees
 * are materialized from git blobs — the working tree plays no part, so what is
 * checked is exactly what the commit would record.
 */
async function checkStaged(
  root: string,
): Promise<{ count: number; findings: ValidationFinding[] }> {
  const repoRoot = dirname(root);
  const prefix = relative(repoRoot, root);

  const taxonomy = await stagedTaxonomy(repoRoot, prefix);
  const head = await graphAt(repoRoot, await lsTree(repoRoot, "HEAD", prefix), "HEAD:", taxonomy);
  const staged = await graphAt(repoRoot, await lsStaged(repoRoot, prefix), ":", taxonomy);

  const findings = [
    ...validate(staged, taxonomy),
    ...stagedBoundary(head, staged, taxonomy),
  ];
  return { count: staged.byId.size, findings };
}

/** Build a graph from the governance markdown blobs at a git ref/index. */
async function graphAt(
  repoRoot: string,
  paths: string[],
  refPrefix: string,
  taxonomy: Taxonomy,
): Promise<Graph> {
  const nodes: GovNode[] = [];
  for (const path of paths.filter((p) => p.endsWith(".md"))) {
    const source = await showFile(repoRoot, `${refPrefix}${path}`);
    if (source === null) continue;
    const node = nodeFromSource(source, path);
    if (node) nodes.push(node);
  }
  return buildGraph(nodes, taxonomy);
}

/** The effective taxonomy for the staged snapshot (staged override, or defaults). */
async function stagedTaxonomy(repoRoot: string, prefix: string): Promise<Taxonomy> {
  const raw = await showFile(repoRoot, `:${prefix}/${TAXONOMY_FILE}`);
  return raw === null ? DEFAULT_TAXONOMY : parseTaxonomyOverride(raw);
}

/** Print a human-readable summary of findings grouped by severity. */
function report(nodeCount: number, findings: ValidationFinding[]): void {
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  for (const f of [...errors, ...warns]) {
    const tag = f.severity === "error" ? "ERROR" : "warn ";
    console.log(`${tag}  ${f.code}  ${f.nodeId}: ${f.message}`);
  }

  console.log("");
  console.log(
    `Checked ${nodeCount} node(s): ${errors.length} error(s), ${warns.length} warning(s).`,
  );
}
