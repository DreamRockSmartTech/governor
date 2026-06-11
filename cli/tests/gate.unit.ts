import { assertEquals } from "@std/assert";
import type { GovNode } from "@dreamrock/governor-core";
import { partialNote } from "../src/commands/gate.ts";

function gate(fm: Record<string, unknown> = {}): GovNode {
  return {
    id: "gate-01-g",
    uid: "uid-g",
    nodeType: "gate",
    frontmatter: { id: "gate-01-g", node_type: "gate", status: "open", ...fm },
    body: "",
    path: "gate-01-g.md",
  };
}

Deno.test("partialNote surfaces the human-owned bypass on a failed gate", () => {
  const note = partialNote(gate({ partial: true }), "failed");

  assertEquals(
    note,
    "partial: true — a human accepted shipping over this failing gate (on record)",
  );
});

Deno.test("partialNote is silent when the gate cleared or partial is unset/false", () => {
  assertEquals(partialNote(gate({ partial: true }), "cleared"), null);
  assertEquals(partialNote(gate({ partial: false }), "failed"), null);
  assertEquals(partialNote(gate(), "failed"), null);
});
