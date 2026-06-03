/**
 * Shared write spine for the mutation commands.
 *
 * Every write command follows the same arc: load the tree, build the graph,
 * call a pure core mutation, persist the changed node(s), and regenerate the
 * INDEX. This module factors that arc so each command file stays a thin adapter
 * from CLI args to a core call.
 *
 * @module
 */

import { join } from "@std/path";
import {
  buildGraph,
  DEFAULT_TAXONOMY,
  type GovNode,
  type Graph,
  loadGovernance,
  renderIndex,
  serializeNode,
} from "@dreamrock/governor-core";

/** Load a `.governance/` root into a built graph. */
export async function loadGraph(root: string): Promise<Graph> {
  const nodes = await loadGovernance(root);
  return buildGraph(nodes, DEFAULT_TAXONOMY);
}

/**
 * Persist a node to disk. Existing nodes are written back to their `path`; a new
 * node (empty `path`) is placed at `<root>/<nodeType>s/<id>.md`. Returns the
 * absolute path written.
 */
export async function writeNode(root: string, node: GovNode): Promise<string> {
  const target = node.path && node.path.length > 0 ? node.path : defaultPath(root, node);
  await Deno.mkdir(dirOf(target), { recursive: true });
  await Deno.writeTextFile(target, serializeNode(node.frontmatter, node.body));
  return target;
}

/** Regenerate `<root>/INDEX.md` from the current on-disk tree. */
export async function regenIndex(root: string): Promise<void> {
  const graph = await loadGraph(root);
  const markdown = renderIndex(graph, DEFAULT_TAXONOMY);
  await Deno.writeTextFile(
    join(root, "INDEX.md"),
    markdown.endsWith("\n") ? markdown : markdown + "\n",
  );
}

/** The conventional file path for a new node: `<root>/<nodeType>s/<id>.md`. */
function defaultPath(root: string, node: GovNode): string {
  return join(root, `${node.nodeType}s`, `${node.id}.md`);
}

/** The directory portion of a file path. */
function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}
