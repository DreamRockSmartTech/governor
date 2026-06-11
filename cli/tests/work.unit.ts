import { assert, assertEquals } from "@std/assert";
import { buildGraph, DEFAULT_TAXONOMY, type GovNode } from "@dreamrock/governor-core";
import { nodeContext } from "../src/commands/work.ts";

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

Deno.test("nodeContext reports status, blocker done-states, blocks, and produced gate", () => {
  const g = buildGraph([
    node("epic-07-x", "epic", {
      status: "open",
      title: "X",
      blocked_by: ["epic-01-done", "epic-02-pending"],
      children: ["workitem-09-y"],
      produces_gate: "gate-03-z",
    }),
    node("epic-01-done", "epic", { status: "complete" }),
    node("epic-02-pending", "epic", { status: "open" }),
    node("workitem-09-y", "workitem"),
    node("gate-03-z", "gate", { status: "open" }),
  ], DEFAULT_TAXONOMY);

  const ctx = nodeContext(g, "epic-07-x")!;

  assertEquals(ctx.id, "epic-07-x");
  assertEquals(ctx.status, "open");
  // Frozen: its child derives from it (inbound `parent`, a freezing kind).
  assertEquals(ctx.frozen, true);
  assertEquals(ctx.blockedBy, [
    { id: "epic-01-done", done: true },
    { id: "epic-02-pending", done: false },
  ]);
  assert(ctx.downstream.includes("workitem-09-y"));
  assertEquals(ctx.gate, { id: "gate-03-z", status: "open" });
});

Deno.test("nodeContext returns null for an unknown id", () => {
  const g = buildGraph([node("epic-01-a", "epic")], DEFAULT_TAXONOMY);
  assertEquals(nodeContext(g, "epic-99-ghost"), null);
});

Deno.test("nodeContext marks the depended-upon node as frozen, not its dependent", () => {
  const g = buildGraph([
    node("masterplan-01-x", "masterplan", { children: ["epic-01-a"] }),
    node("epic-01-a", "epic", { parent: "masterplan-01-x" }),
  ], DEFAULT_TAXONOMY);

  // The masterplan is frozen — its child relies on it (ADR-0002). The child
  // is workflow and stays editable.
  assertEquals(nodeContext(g, "masterplan-01-x")!.frozen, true);
  assertEquals(nodeContext(g, "epic-01-a")!.frozen, false);
});
