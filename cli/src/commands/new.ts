/**
 * `governor new` — create and initialize a node (the only creation path).
 *
 * Allocates the `{NN}` from the counter file, generates the `uid`, writes valid
 * ordered frontmatter, wires the declared edge's reverse onto its target, and
 * regenerates the INDEX. Flag-driven; missing required fields are an error
 * (interactive prompting is a later, porcelain concern).
 *
 * @module
 */

import { dirname } from "@std/path";
import {
  allocate,
  createNode,
  DEFAULT_TAXONOMY,
  MutationError,
  readGitConfig,
} from "@dreamrock/governor-core";
import { loadGraph, regenIndex, writeNode } from "../write.ts";

/** Options for the new command. */
export interface NewOptions {
  root: string;
  nodeType: string;
  title: string;
  /** Declared edges by kind, e.g. `{ parent: "masterplan-01-x" }`. */
  edges: Record<string, string>;
}

/** Run the new command. Returns the exit code. */
export async function runNew(opts: NewOptions): Promise<number> {
  if (!opts.title) {
    console.error("new: --title is required");
    return 1;
  }
  if (!DEFAULT_TAXONOMY.nodeTypes.includes(opts.nodeType)) {
    console.error(`new: unknown node type "${opts.nodeType}"`);
    return 1;
  }

  const graph = await loadGraph(opts.root);
  const nn = await allocate(opts.root, opts.nodeType, graph);
  // Auto-stamp owner = committer identity (stewardship record, not approval).
  const owner = (await readGitConfig(dirname(opts.root), "user.email")) ?? undefined;

  try {
    const { node, updated } = createNode(graph, {
      nodeType: opts.nodeType,
      nn,
      title: opts.title,
      owner,
      edges: opts.edges,
      taxonomy: DEFAULT_TAXONOMY,
    });
    const written = await writeNode(opts.root, node);
    for (const target of updated) await writeNode(opts.root, target);
    await regenIndex(opts.root);
    console.log(`Created ${node.id} (${written})`);
    return 0;
  } catch (err) {
    if (err instanceof MutationError) {
      console.error(`new: ${err.message}`);
      return 1;
    }
    throw err;
  }
}
