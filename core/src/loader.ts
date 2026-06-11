/**
 * Loader: walk a `.governance/` root, parse every markdown file, and build the
 * set of {@link GovNode}s.
 *
 * A markdown file is a node iff its frontmatter declares both `id` and
 * `node_type`. Files without that pairing (reference docs like `ISA-FORMAT.md`)
 * are silently skipped — they are part of the tree but not part of the graph.
 *
 * @module
 */

import { walk } from "@std/fs/walk";
import { splitFrontmatter } from "./frontmatter.ts";
import type { GovNode } from "./types.ts";

/**
 * Load all governance nodes under `root`, recursively. Non-node markdown files
 * (no `id` + `node_type` in frontmatter) are skipped. Order is filesystem-walk
 * order; callers that need determinism should sort by `id`.
 *
 * @throws if `root` does not exist or is not readable.
 */
export async function loadGovernance(root: string): Promise<GovNode[]> {
  const nodes: GovNode[] = [];

  for await (const entry of walk(root, { exts: [".md"], includeDirs: false })) {
    const source = await Deno.readTextFile(entry.path);
    const node = nodeFromSource(source, entry.path);
    if (node) nodes.push(node);
  }

  return nodes;
}

/**
 * Convert a markdown source into a {@link GovNode}, or `null` when the
 * document is not a node (missing or non-string `id`/`node_type`). The
 * single-file counterpart of {@link loadGovernance} — used by callers that
 * materialize tree snapshots from somewhere other than the filesystem (e.g.
 * git blobs for the staged check).
 */
export function nodeFromSource(source: string, path: string): GovNode | null {
  const { frontmatter, body } = splitFrontmatter(source);
  if (!frontmatter) return null;

  const id = frontmatter.id;
  const nodeType = frontmatter.node_type;
  if (typeof id !== "string" || typeof nodeType !== "string") return null;

  const uid = typeof frontmatter.uid === "string" ? frontmatter.uid : "";
  return { id, uid, nodeType, frontmatter, body, path };
}
