import { assertEquals } from "@std/assert";
import { type GovNode } from "@dreamrock/governor-core";
import { gateIdFor, shouldComplete } from "../src/commands/done.ts";

function node(fm: Record<string, unknown> = {}): GovNode {
  return {
    id: "epic-01-a",
    uid: crypto.randomUUID(),
    nodeType: "epic",
    frontmatter: { id: "epic-01-a", node_type: "epic", status: "open", ...fm },
    body: "",
    path: "epic-01-a.md",
  };
}

Deno.test("gateIdFor returns the produced gate id, or null when none", () => {
  assertEquals(gateIdFor(node({ produces_gate: "gate-02-x" })), "gate-02-x");
  assertEquals(gateIdFor(node()), null);
});

Deno.test("shouldComplete: no gate -> complete", () => {
  assertEquals(shouldComplete(null), true);
});

Deno.test("shouldComplete: gate cleared -> complete", () => {
  assertEquals(shouldComplete("cleared"), true);
});

Deno.test("shouldComplete: gate failed -> do NOT complete", () => {
  assertEquals(shouldComplete("failed"), false);
});
