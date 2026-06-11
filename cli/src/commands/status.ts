/**
 * `governor status` — transition a work/plan node's status. Validated against
 * the type's enum and freeze. Gate status is machine-owned by the runner, so
 * this refuses gates and points to `gate run`.
 *
 * @module
 */

import { MutationError, transitionStatus } from "@dreamrock/governor-core";
import { loadTree, regenIndex, writeNode } from "../write.ts";

/** Options for the status command. */
export interface StatusOptions {
  root: string;
  id: string;
  status: string;
}

/** Run the status command. Returns the exit code. */
export async function runStatus(opts: StatusOptions): Promise<number> {
  const { graph, taxonomy } = await loadTree(opts.root);
  try {
    const updated = transitionStatus(graph, opts.id, opts.status, taxonomy);
    await writeNode(opts.root, updated);
    await regenIndex(opts.root);
    console.log(`Set status=${opts.status} on ${opts.id}`);
    return 0;
  } catch (err) {
    if (err instanceof MutationError) {
      console.error(`status: ${err.message}`);
      return 1;
    }
    throw err;
  }
}
