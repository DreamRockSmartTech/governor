/**
 * `governor gate run` — execute a gate's proof and write its machine-owned
 * status. `--all` runs every gate. The runner maps the runnable's exit code to
 * `cleared`/`failed` (bidirectional); the human-owned `partial` flag is left
 * untouched.
 *
 * @module
 */

import { type GovNode, type Graph, runGate } from "@dreamrock/governor-core";
import { loadGraph, regenIndex, writeNode } from "../write.ts";

/** Options for the gate command. */
export interface GateOptions {
  root: string;
  /** A specific gate id, or null when `--all`. */
  id: string | null;
  all: boolean;
}

/** Run the gate command. Returns the exit code (1 if any gate failed). */
export async function runGateCommand(opts: GateOptions): Promise<number> {
  const graph = await loadGraph(opts.root);

  const gates: GovNode[] = opts.all
    ? [...graph.byId.values()].filter((n) => n.nodeType === "gate")
    : pickOne(graph, opts.id);

  if (gates.length === 0) {
    console.error("gate: no matching gate node");
    return 1;
  }

  let anyFailed = false;
  for (const gate of gates) {
    const result = await runGate(gate, opts.root);
    await writeNode(opts.root, result.node);
    console.log(`${gate.id}: ${result.status}`);
    if (result.output.trim()) console.log(indent(result.output.trim()));
    if (result.status === "failed") anyFailed = true;
  }
  await regenIndex(opts.root);
  return anyFailed ? 1 : 0;
}

/** Resolve a single requested gate into a list (empty if absent / not a gate). */
function pickOne(graph: Graph, id: string | null): GovNode[] {
  if (!id) return [];
  const node = graph.byId.get(id);
  return node && node.nodeType === "gate" ? [node] : [];
}

/** Indent multi-line output for readable nesting under the gate line. */
function indent(text: string): string {
  return text.split("\n").map((l) => `  ${l}`).join("\n");
}
