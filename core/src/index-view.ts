/**
 * INDEX view renderer.
 *
 * The INDEX is a generated projection of the graph, never hand-maintained (per
 * the design of record, control 5). This module renders the markdown from a
 * built graph: a per-node-type count table, the project root pointer, and the
 * masterplan listing with titles and statuses. The source of truth is always
 * the nodes themselves; this is a convenience view that degrades to plain
 * `ls`/`cat`.
 *
 * @module
 */

import type { Taxonomy } from "./taxonomy.ts";
import type { GovNode, Graph } from "./types.ts";

/**
 * Render the governance INDEX markdown for a built {@link Graph}. Counts are
 * derived live; the masterplan list reflects current titles and statuses. The
 * output is deterministic (node types in taxonomy order, masterplans by id).
 */
export function renderIndex(graph: Graph, taxonomy: Taxonomy): string {
  const nodes = [...graph.byId.values()];
  const root = nodes.find((n) => n.nodeType === "project");

  const lines: string[] = [
    "# Governance Index",
    "",
    "> **Generated view.** The source of truth is the `.governance/` node graph (frontmatter edges),",
    "> not this file. Regenerate with `governor index`. The graph degrades to plain `ls`/`cat`.",
    "",
  ];

  if (root) lines.push(`Project root: [[${root.id}]] (\`${title(root)}\`).`, "");

  lines.push("## Node buckets", "", "| Node type | Count |", "| --- | --- |");
  for (const type of taxonomy.nodeTypes) {
    const count = nodes.filter((n) => n.nodeType === type).length;
    if (count > 0) lines.push(`| ${type} | ${count} |`);
  }
  lines.push("");

  const masterplans = nodes
    .filter((n) => n.nodeType === "masterplan")
    .sort((a, b) => a.id.localeCompare(b.id));
  if (masterplans.length > 0) {
    lines.push("## MasterPlans", "");
    for (const mp of masterplans) {
      lines.push(`- [[${mp.id}]] — ${title(mp)} (${status(mp)})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** A node's `title`, or its id if untitled. */
function title(node: GovNode): string {
  const t = node.frontmatter.title;
  return typeof t === "string" ? t : node.id;
}

/** A node's `status`, or `"?"` if absent. */
function status(node: GovNode): string {
  const s = node.frontmatter.status;
  return typeof s === "string" ? s : "?";
}
