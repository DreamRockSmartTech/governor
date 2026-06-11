import { assert, assertEquals } from "@std/assert";
import { DEFAULT_TAXONOMY, mergeTaxonomy } from "../src/taxonomy.ts";
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

Deno.test("a depended-upon node (parent with children) is frozen, naming its dependents", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  const state = freezeState(g, "masterplan-01-x", DEFAULT_TAXONOMY);

  assertEquals(state.frozen, true);
  assertEquals(state.frozenBy, ["epic-01-a"]);
});

Deno.test("a dependent node (child) is not frozen by its parent claiming it", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  assertEquals(isFrozen(g, "epic-01-a", DEFAULT_TAXONOMY), false);
});

Deno.test("a blocker is frozen while something it blocks relies on it; the blocked is not", () => {
  const g = buildGraph([
    node("workitem-01-a", "workitem", { blocks: ["workitem-02-b"] }),
    node("workitem-02-b", "workitem", { blocked_by: ["workitem-01-a"] }),
  ], DEFAULT_TAXONOMY);

  assertEquals(isFrozen(g, "workitem-01-a", DEFAULT_TAXONOMY), true);
  assertEquals(isFrozen(g, "workitem-02-b", DEFAULT_TAXONOMY), false);
});

Deno.test("a superseded node is frozen (historical record); its superseder is not", () => {
  const g = buildGraph([
    node("decision-02-new", "decision", { supersedes: ["decision-01-old"] }),
    node("decision-01-old", "decision", { superseded_by: ["decision-02-new"] }),
  ], DEFAULT_TAXONOMY);

  assertEquals(isFrozen(g, "decision-01-old", DEFAULT_TAXONOMY), true);
  assertEquals(isFrozen(g, "decision-02-new", DEFAULT_TAXONOMY), false);
});

Deno.test("freeze derives from a one-sided declaration too (drift cannot unfreeze)", () => {
  // Only the child declares parent; the parent never declared children. The
  // parent is still frozen — freeze is derived from the graph, not bookkeeping.
  const g = buildGraph([
    node("epic-01-mandate", "epic"),
    node("workitem-01-task", "workitem", { parent: "epic-01-mandate" }),
  ], DEFAULT_TAXONOMY);

  const state = freezeState(g, "epic-01-mandate", DEFAULT_TAXONOMY);
  assertEquals(state.frozen, true);
  assertEquals(state.frozenBy, ["workitem-01-task"]);
});

Deno.test("a repo-defined freezing edge kind from the taxonomy freezes its target", () => {
  // A repo override adds requires/required_by: declaring `requires` is a
  // reliance declaration, so its target freezes — derived from the taxonomy,
  // not a hard-coded kind list.
  const taxonomy = mergeTaxonomy(DEFAULT_TAXONOMY, {
    edges: {
      requires: {
        name: "requires",
        reverse: "required_by",
        structural: true,
        freezes: true,
        toDependent: false,
      },
      required_by: {
        name: "required_by",
        reverse: "requires",
        structural: true,
        freezes: false,
        toDependent: true,
      },
    },
  });
  const g = buildGraph([
    node("epic-01-a", "epic", { requires: ["epic-02-b"] }),
    node("epic-02-b", "epic"),
  ], taxonomy);

  assertEquals(isFrozen(g, "epic-02-b", taxonomy), true);
  assertEquals(isFrozen(g, "epic-01-a", taxonomy), false);
});

Deno.test("a gate's guarded_by freezes the epic it proves; produces_gate does not freeze the gate", () => {
  // The gate's meaning derives from the epic (like a child), so the epic
  // freezes. The gate stays unfrozen: its status is machine-owned and its
  // `partial` bypass must remain human-settable.
  const g = buildGraph([
    node("epic-01-a", "epic", { produces_gate: ["gate-01-g"] }),
    node("gate-01-g", "gate", { guarded_by: ["epic-01-a"] }),
  ], DEFAULT_TAXONOMY);

  assertEquals(isFrozen(g, "epic-01-a", DEFAULT_TAXONOMY), true);
  assertEquals(isFrozen(g, "gate-01-g", DEFAULT_TAXONOMY), false);
});

Deno.test("a weak inbound cites edge does not freeze the target", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  // decision-00-d is only cited (one-way, non-structural) — not frozen.
  assertEquals(isFrozen(g, "decision-00-d", DEFAULT_TAXONOMY), false);
});

Deno.test("guardMutation returns a finding for a frozen node and null otherwise", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  const frozen = guardMutation(g, "masterplan-01-x", DEFAULT_TAXONOMY);
  assert(frozen !== null);
  assertEquals(frozen.code, "frozen-node");
  assertEquals(frozen.severity, "error");

  assertEquals(guardMutation(g, "epic-01-a", DEFAULT_TAXONOMY), null);
});
