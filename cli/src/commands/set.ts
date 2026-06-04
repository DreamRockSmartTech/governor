/**
 * `governor set` — update a plain (non-structural, non-status) frontmatter
 * scalar. Structural edges go through `edge`; status through `status`. Attempts
 * on those fields error with a pointer. Freeze-guarded and write-validated by
 * the core `setField`.
 *
 * @module
 */

import { DEFAULT_TAXONOMY, MutationError, setField } from "@dreamrock/governor-core";
import { loadGraph, regenIndex, writeNode } from "../write.ts";

/** Options for the set command. */
export interface SetOptions {
  root: string;
  id: string;
  field: string;
  value: string;
}

/** Run the set command. Returns the exit code. */
export async function runSet(opts: SetOptions): Promise<number> {
  const graph = await loadGraph(opts.root);
  try {
    const updated = setField(graph, opts.id, opts.field, opts.value, DEFAULT_TAXONOMY);
    await writeNode(opts.root, updated);
    await regenIndex(opts.root);
    console.log(`Set ${opts.field}=${opts.value} on ${opts.id}`);
    return 0;
  } catch (err) {
    if (err instanceof MutationError) {
      console.error(`set: ${err.message}`);
      return 1;
    }
    throw err;
  }
}
