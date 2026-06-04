import { assertEquals } from "@std/assert";
import { buildGraph, DEFAULT_TAXONOMY, type GovNode } from "@dreamrock/governor-core";
import { unblockedOpenWorkItems } from "../src/commands/next.ts";

function node(id: string, nodeType: string, fm: Record<string, unknown> = {}): GovNode {
  return {
    id,
    uid: crypto.randomUUID(),
    nodeType,
    frontmatter: { id, node_type: nodeType, status: "open", ...fm },
    body: "",
    path: `${id}.md`,
  };
}

Deno.test("unblockedOpenWorkItems lists an open workitem with no blockers", () => {
  const g = buildGraph([node("workitem-01-a", "workitem")], DEFAULT_TAXONOMY);

  assertEquals(unblockedOpenWorkItems(g).map((n) => n.id), ["workitem-01-a"]);
});

Deno.test("a workitem blocked by an incomplete node is excluded", () => {
  const g = buildGraph([
    node("workitem-01-a", "workitem", { blocked_by: ["epic-01-x"] }),
    node("epic-01-x", "epic", { status: "open" }),
  ], DEFAULT_TAXONOMY);

  assertEquals(unblockedOpenWorkItems(g).map((n) => n.id), []);
});

Deno.test("a workitem whose blockers are all done is listed", () => {
  const g = buildGraph([
    node("workitem-01-a", "workitem", { blocked_by: ["epic-01-x", "gate-01-y"] }),
    node("epic-01-x", "epic", { status: "complete" }),
    node("gate-01-y", "gate", { status: "cleared" }),
  ], DEFAULT_TAXONOMY);

  assertEquals(unblockedOpenWorkItems(g).map((n) => n.id), ["workitem-01-a"]);
});

Deno.test("non-open workitems are excluded even if unblocked", () => {
  const g = buildGraph([
    node("workitem-01-a", "workitem", { status: "complete" }),
    node("workitem-02-b", "workitem", { status: "closed" }),
    node("workitem-03-c", "workitem", { status: "open" }),
  ], DEFAULT_TAXONOMY);

  assertEquals(unblockedOpenWorkItems(g).map((n) => n.id), ["workitem-03-c"]);
});

Deno.test("results are sorted by id", () => {
  const g = buildGraph([
    node("workitem-03-c", "workitem"),
    node("workitem-01-a", "workitem"),
    node("workitem-02-b", "workitem"),
  ], DEFAULT_TAXONOMY);

  assertEquals(
    unblockedOpenWorkItems(g).map((n) => n.id),
    ["workitem-01-a", "workitem-02-b", "workitem-03-c"],
  );
});
