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

import { dirname, join } from "@std/path";
import {
  buildGraph,
  type GovNode,
  type Graph,
  loadGovernance,
  loadTaxonomy,
  renderIndex,
  serializeNode,
  type Taxonomy,
} from "@dreamrock/governor-core";

/** A loaded tree: the built graph plus the effective taxonomy it was built with. */
export interface Tree {
  graph: Graph;
  taxonomy: Taxonomy;
}

/**
 * Load a `.governance/` root into a built graph, under the repo's effective
 * taxonomy (shipped defaults + the optional `taxonomy.json` override). This is
 * the single resolve point — every command consumes the taxonomy from here so
 * repo-defined vocabulary applies uniformly.
 */
export async function loadTree(root: string): Promise<Tree> {
  const taxonomy = await loadTaxonomy(root);
  const nodes = await loadGovernance(root);
  return { graph: buildGraph(nodes, taxonomy), taxonomy };
}

/**
 * Persist a node to disk. Existing nodes are written back to their `path`; a new
 * node (empty `path`) is placed at `<root>/<nodeType>s/<id>.md`. Returns the
 * absolute path written.
 */
export async function writeNode(root: string, node: GovNode): Promise<string> {
  const target = node.path && node.path.length > 0 ? node.path : defaultPath(root, node);
  await Deno.mkdir(dirname(target), { recursive: true });
  await Deno.writeTextFile(target, serializeNode(node.frontmatter, node.body));
  return target;
}

/** Regenerate `<root>/INDEX.md` from the current on-disk tree. */
export async function regenIndex(root: string): Promise<void> {
  const { graph, taxonomy } = await loadTree(root);
  const markdown = renderIndex(graph, taxonomy);
  await Deno.writeTextFile(
    join(root, "INDEX.md"),
    markdown.endsWith("\n") ? markdown : markdown + "\n",
  );
}

/** The conventional file path for a new node: `<root>/<nodeType>s/<id>.md`. */
function defaultPath(root: string, node: GovNode): string {
  return join(root, `${node.nodeType}s`, `${node.id}.md`);
}
