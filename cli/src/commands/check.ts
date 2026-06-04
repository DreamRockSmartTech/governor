/**
 * `governor check` — the standalone validator entry point.
 *
 * Loads a `.governance/` tree, builds the graph, runs the shared validation core
 * (the same `validate` the future write path calls), prints findings grouped by
 * severity, and exits non-zero iff any `error` was found. `--json` emits the
 * findings as machine-readable JSON — the seam for CI consumption (record
 * stage 2).
 *
 * @module
 */

import {
  buildGraph,
  DEFAULT_TAXONOMY,
  loadGovernance,
  validate,
  type ValidationFinding,
} from "@dreamrock/governor-core";

/** Options for the check command. */
export interface CheckOptions {
  /** Path to the `.governance/` root to validate. */
  root: string;
  /** Emit findings as JSON instead of human-readable text. */
  json: boolean;
}

/** The process exit code for a set of findings: 1 iff any error, else 0. */
export function exitCodeFor(findings: ValidationFinding[]): number {
  return findings.some((f) => f.severity === "error") ? 1 : 0;
}

/**
 * Run the check command. Returns the exit code (the caller owns `Deno.exit`).
 */
export async function runCheck(opts: CheckOptions): Promise<number> {
  const nodes = await loadGovernance(opts.root);
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);
  const findings = validate(graph, DEFAULT_TAXONOMY);

  if (opts.json) {
    console.log(JSON.stringify(findings, null, 2));
    return exitCodeFor(findings);
  }

  report(nodes.length, findings);
  return exitCodeFor(findings);
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
