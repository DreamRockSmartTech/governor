/**
 * `governor edge add|rm` — add or remove a structural edge, maintaining both
 * sides. A structural change on a node that has dependents is blocked and routed
 * to supersession by the core `addEdge`/`removeEdge`.
 *
 * @module
 */

import { addEdge, MutationError, removeEdge } from "@dreamrock/governor-core";
import { loadTree, regenIndex, writeNode } from "../write.ts";

/** Options for the edge command. */
export interface EdgeOptions {
  root: string;
  op: "add" | "rm";
  from: string;
  kind: string;
  to: string;
}

/** Run the edge command. Returns the exit code. */
export async function runEdge(opts: EdgeOptions): Promise<number> {
  const { graph, taxonomy } = await loadTree(opts.root);
  try {
    const updated = opts.op === "add"
      ? addEdge(graph, opts.from, opts.kind, opts.to, taxonomy)
      : removeEdge(graph, opts.from, opts.kind, opts.to, taxonomy);
    for (const node of updated) await writeNode(opts.root, node);
    await regenIndex(opts.root);
    console.log(`${opts.op === "add" ? "Added" : "Removed"} ${opts.from} ${opts.kind} ${opts.to}`);
    return 0;
  } catch (err) {
    if (err instanceof MutationError) {
      console.error(`edge: ${err.message}`);
      return 1;
    }
    throw err;
  }
}
