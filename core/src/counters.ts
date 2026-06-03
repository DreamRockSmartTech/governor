/**
 * The persisted high-water `{NN}` counter (design of record, control 3).
 *
 * `{NN}` is a monotonic high-water number per node type: the writer allocates
 * `max+1` and never reuses or gap-fills, so deletions leave permanent holes by
 * design. A directory scan alone is insufficient — deleting the highest node
 * would wrongly free its number — so the high-water mark is persisted in
 * `.governance/counters.json` (`{ "epic": 27, ... }`). It is authority-bearing
 * and committed to git.
 *
 * Bootstrap: when the file has no entry for a type yet, the current max is
 * derived once from the live tree, then persisted; from then on the file is
 * authoritative and the tree is never rescanned for that type.
 *
 * @module
 */

import { join } from "@std/path";
import type { Graph } from "./types.ts";

/** The counter map: node type → current high-water `{NN}`. */
export type Counters = Record<string, number>;

const COUNTERS_FILE = "counters.json";

/** Path to the counter file under a `.governance/` root. */
function counterPath(root: string): string {
  return join(root, COUNTERS_FILE);
}

/** Load the counter map, or `{}` if the file does not exist yet. */
export async function loadCounters(root: string): Promise<Counters> {
  try {
    return JSON.parse(await Deno.readTextFile(counterPath(root))) as Counters;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return {};
    throw err;
  }
}

/** Write the counter map atomically (temp file + rename). */
export async function writeCounters(root: string, counters: Counters): Promise<void> {
  const target = counterPath(root);
  const tmp = `${target}.tmp`;
  await Deno.writeTextFile(tmp, JSON.stringify(counters, null, 2) + "\n");
  await Deno.rename(tmp, target);
}

/**
 * Allocate the next `{NN}` for `nodeType`: `current + 1`, where `current` is the
 * persisted high-water if present, otherwise bootstrapped once from the live
 * tree's max for that type. The new high-water is persisted before returning, so
 * allocation is monotonic across calls and survives deletion of the highest
 * node.
 */
export async function allocate(root: string, nodeType: string, graph: Graph): Promise<number> {
  const counters = await loadCounters(root);
  const current = counters[nodeType] ?? treeMax(graph, nodeType);
  const next = current + 1;
  counters[nodeType] = next;
  await writeCounters(root, counters);
  return next;
}

/** The highest `{NN}` currently present in the graph for `nodeType` (0 if none). */
function treeMax(graph: Graph, nodeType: string): number {
  let max = 0;
  for (const node of graph.byId.values()) {
    if (node.nodeType !== nodeType) continue;
    const match = node.id.match(/-(\d+)-/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}
