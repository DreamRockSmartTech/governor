import { assert, assertEquals } from "@std/assert";
import { DEFAULT_TAXONOMY } from "../src/taxonomy.ts";
import { buildGraph } from "../src/graph.ts";
import { freezeState, guardMutation, isFrozen } from "../src/freeze.ts";
import type { GovNode } from "../src/types.ts";

function node(id: string, nodeType: string, fm: Record<string, unknown> = {}): GovNode {
  return {
    id,
    uid: crypto.randomUUID(),
    nodeType,
    frontmatter: { id, node_type: nodeType, ...fm },
    body: "",
    path: `${id}.md`,
  };
}

// masterplan --children--> epic ; epic --cites--> decision (weak, non-structural)
function fixture(): GovNode[] {
  return [
    node("masterplan-01-x", "masterplan", { children: ["epic-01-a"] }),
    node("epic-01-a", "epic", { parent: "masterplan-01-x", cites: ["decision-00-d"] }),
    node("decision-00-d", "decision"),
  ];
}

Deno.test("a node with an inbound structural edge is frozen, naming what froze it", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  const state = freezeState(g, "epic-01-a", DEFAULT_TAXONOMY);

  assertEquals(state.frozen, true);
  assertEquals(state.frozenBy, ["masterplan-01-x"]);
});

Deno.test("a node with no inbound structural edge is not frozen", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  assertEquals(isFrozen(g, "masterplan-01-x", DEFAULT_TAXONOMY), false);
});

Deno.test("a weak inbound cites edge does not freeze the target", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  // decision-00-d is only cited (one-way, non-structural) — not frozen.
  assertEquals(isFrozen(g, "decision-00-d", DEFAULT_TAXONOMY), false);
});

Deno.test("guardMutation returns a finding for a frozen node and null otherwise", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  const frozen = guardMutation(g, "epic-01-a", DEFAULT_TAXONOMY);
  assert(frozen !== null);
  assertEquals(frozen.code, "frozen-node");
  assertEquals(frozen.severity, "error");

  assertEquals(guardMutation(g, "masterplan-01-x", DEFAULT_TAXONOMY), null);
});
