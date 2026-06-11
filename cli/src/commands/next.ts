/**
 * `governor next` — porcelain: list open WorkItems that are ready to work on
 * (unblocked). "What can I pick up now?" Pure read; composes the graph, no
 * mutation. The pick → orient (`work`) → finish (`done`) loop.
 *
 * @module
 */

import {
  asList,
  DONE_STATUSES,
  type GovNode,
  type Graph,
  statusOf,
} from "@dreamrock/governor-core";
import { loadTree } from "../write.ts";

/**
 * Open WorkItems that are unblocked: every `blocked_by` target resolves to a
 * done status (or there are none). Sorted by id. Pure.
 */
export function unblockedOpenWorkItems(graph: Graph): GovNode[] {
  const ready: GovNode[] = [];
  for (const node of graph.byId.values()) {
    if (node.nodeType !== "workitem" || statusOf(node) !== "open") continue;
    const blockers = asList(node.frontmatter.blocked_by);
    const blocked = blockers.some((id) => !DONE_STATUSES.has(statusOf(graph.byId.get(id))));
    if (!blocked) ready.push(node);
  }
  return ready.sort((a, b) => a.id.localeCompare(b.id));
}

/** Options for the next command. */
export interface NextOptions {
  root: string;
}

/** Run the next command. Returns the exit code (always 0). */
export async function runNext(opts: NextOptions): Promise<number> {
  const { graph } = await loadTree(opts.root);
  const ready = unblockedOpenWorkItems(graph);

  if (ready.length === 0) {
    console.log("No unblocked open WorkItems.");
    return 0;
  }
  console.log("Ready to work on:");
  for (const node of ready) {
    const title = typeof node.frontmatter.title === "string" ? node.frontmatter.title : node.id;
    console.log(`  ${node.id} — ${title}`);
  }
  return 0;
}
