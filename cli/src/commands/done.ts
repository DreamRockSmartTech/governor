/**
 * `governor done <id>` — porcelain: finish a node. If it declares a
 * `produces_gate`, run that gate (the proof-of-done); complete the node only if
 * the gate clears (or there is no gate). Then regenerate the INDEX. The gate is
 * the evidence — a failing gate blocks completion.
 *
 * Composes the core `runGate` + `transitionStatus`; adds no new core logic.
 *
 * @module
 */

import { dirname } from "@std/path";
import {
  DEFAULT_TAXONOMY,
  type GovNode,
  MutationError,
  runGate,
  transitionStatus,
} from "@dreamrock/governor-core";
import { loadGraph, regenIndex, writeNode } from "../write.ts";

/** The produced-gate id a node declares, or null. Pure. */
export function gateIdFor(node: GovNode): string | null {
  const id = node.frontmatter.produces_gate;
  return typeof id === "string" ? id : null;
}

/**
 * Whether a node should be completed given its gate's resulting status (or null
 * when it has no gate). Complete iff there is no gate, or the gate cleared. Pure.
 */
export function shouldComplete(gateStatus: "cleared" | "failed" | null): boolean {
  return gateStatus === null || gateStatus === "cleared";
}

/** Options for the done command. */
export interface DoneOptions {
  root: string;
  id: string;
}

/** Run the done command. Returns the exit code (1 if a gate fails). */
export async function runDone(opts: DoneOptions): Promise<number> {
  const graph = await loadGraph(opts.root);
  const node = graph.byId.get(opts.id);
  if (!node) {
    console.error(`done: no node with id "${opts.id}"`);
    return 1;
  }

  // Run the produced gate first, if any — it is the proof-of-done.
  const gateId = gateIdFor(node);
  let gateStatus: "cleared" | "failed" | null = null;
  if (gateId) {
    const gate = graph.byId.get(gateId);
    if (!gate) {
      console.error(`done: produced gate "${gateId}" not found`);
      return 1;
    }
    const result = await runGate(gate, dirname(opts.root));
    await writeNode(opts.root, result.node);
    gateStatus = result.status;
    console.log(`gate ${gateId}: ${result.status}`);
    if (result.output.trim()) console.log(indent(result.output.trim()));
  }

  if (!shouldComplete(gateStatus)) {
    console.error(`done: gate ${gateId} did not clear — "${opts.id}" stays open`);
    await regenIndex(opts.root);
    return 1;
  }

  try {
    const completed = transitionStatus(graph, opts.id, "complete", DEFAULT_TAXONOMY);
    await writeNode(opts.root, completed);
    await regenIndex(opts.root);
    console.log(`Completed ${opts.id}`);
    return 0;
  } catch (err) {
    if (err instanceof MutationError) {
      console.error(`done: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

/** Indent multi-line output under the gate line. */
function indent(text: string): string {
  return text.split("\n").map((l) => `  ${l}`).join("\n");
}
