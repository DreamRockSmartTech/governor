import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { DEFAULT_TAXONOMY } from "../src/taxonomy.ts";
import { buildGraph } from "../src/graph.ts";
import { allocate, loadCounters } from "../src/counters.ts";
import type { GovNode } from "../src/types.ts";

function node(id: string, nodeType: string): GovNode {
  return {
    id,
    uid: crypto.randomUUID(),
    nodeType,
    frontmatter: { id, node_type: nodeType },
    body: "",
    path: `${id}.md`,
  };
}

function scratchRoot(): Promise<string> {
  return Deno.makeTempDir({ prefix: "gov-counters-" });
}

Deno.test("allocate bootstraps from the live tree max when no counter file exists", async () => {
  const root = await scratchRoot();
  const graph = buildGraph(
    [node("epic-01-a", "epic"), node("epic-05-b", "epic")],
    DEFAULT_TAXONOMY,
  );

  const next = await allocate(root, "epic", graph);

  // max present is 05 -> allocate 6.
  assertEquals(next, 6);
  const counters = await loadCounters(root);
  assertEquals(counters.epic, 6);
});

Deno.test("allocate is monotonic and never gap-fills after the max is consumed", async () => {
  const root = await scratchRoot();
  const graph = buildGraph([node("epic-01-a", "epic")], DEFAULT_TAXONOMY);

  const first = await allocate(root, "epic", graph);
  const second = await allocate(root, "epic", graph);

  assertEquals(first, 2);
  assertEquals(second, 3); // not 2 again — counter persisted, no reuse
});

Deno.test("allocate persists per-type and does not free a deleted highest number", async () => {
  const root = await scratchRoot();
  // Seed the file by allocating against a tree whose max is 9.
  const graph = buildGraph([node("epic-09-z", "epic")], DEFAULT_TAXONOMY);
  const a = await allocate(root, "epic", graph); // 10

  // Now the "highest node" (epic-09-z) is deleted: an empty tree. The counter
  // file must still hand out 11, not fall back to scanning the (now empty) tree.
  const emptyGraph = buildGraph([], DEFAULT_TAXONOMY);
  const b = await allocate(root, "epic", emptyGraph);

  assertEquals(a, 10);
  assertEquals(b, 11);
});

Deno.test("counters file is written at .governance root as counters.json", async () => {
  const root = await scratchRoot();
  const graph = buildGraph([node("gate-00-g", "gate")], DEFAULT_TAXONOMY);

  await allocate(root, "gate", graph);

  const raw = await Deno.readTextFile(join(root, "counters.json"));
  assertEquals(JSON.parse(raw).gate, 1);
});
