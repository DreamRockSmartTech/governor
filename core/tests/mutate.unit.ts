import { assert, assertEquals, assertThrows } from "@std/assert";
import { asList } from "../src/fields.ts";
import { DEFAULT_TAXONOMY } from "../src/taxonomy.ts";
import { buildGraph } from "../src/graph.ts";
import {
  addEdge,
  createNode,
  MutationError,
  removeEdge,
  setField,
  transitionStatus,
} from "../src/mutate.ts";
import type { GovNode } from "../src/types.ts";

function node(id: string, nodeType: string, fm: Record<string, unknown> = {}): GovNode {
  return {
    id,
    uid: crypto.randomUUID(),
    nodeType,
    frontmatter: { id, node_type: nodeType, status: fm.status ?? "open", ...fm },
    body: "",
    path: `${id}.md`,
  };
}

Deno.test("createNode builds a valid node and wires the reverse edge on the parent", () => {
  const mp = node("masterplan-01-x", "masterplan");
  const graph = buildGraph([mp], DEFAULT_TAXONOMY);

  const result = createNode(graph, {
    nodeType: "epic",
    nn: 7,
    title: "New Epic",
    owner: "justin@example.com",
    edges: { parent: "masterplan-01-x" },
    taxonomy: DEFAULT_TAXONOMY,
  });

  assertEquals(result.node.id, "epic-07-new-epic");
  assertEquals(result.node.frontmatter.parent, "masterplan-01-x");
  // owner is auto-stamped from the committer identity passed in the spec.
  assertEquals(result.node.frontmatter.owner, "justin@example.com");
  // The masterplan gains children: [epic-07-new-epic].
  const updatedMp = result.updated.find((n) => n.id === "masterplan-01-x")!;
  assertEquals(updatedMp.frontmatter.children, ["epic-07-new-epic"]);
});

Deno.test("createNode omits owner when none is supplied", () => {
  const graph = buildGraph([], DEFAULT_TAXONOMY);

  const result = createNode(graph, {
    nodeType: "workitem",
    nn: 1,
    title: "No owner",
    taxonomy: DEFAULT_TAXONOMY,
  });

  assertEquals("owner" in result.node.frontmatter, false);
});

Deno.test("setField updates a non-structural scalar", () => {
  const graph = buildGraph([node("epic-01-a", "epic")], DEFAULT_TAXONOMY);

  const updated = setField(graph, "epic-01-a", "owner", "justin", DEFAULT_TAXONOMY);

  assertEquals(updated.frontmatter.owner, "justin");
});

Deno.test("setField rejects a structural edge field with a pointer to edge", () => {
  const graph = buildGraph([node("epic-01-a", "epic")], DEFAULT_TAXONOMY);

  const err = assertThrows(
    () => setField(graph, "epic-01-a", "parent", "masterplan-01-x", DEFAULT_TAXONOMY),
    MutationError,
  );
  assert(err.message.includes("edge"));
});

Deno.test("setField rejects the status field with a pointer to status", () => {
  const graph = buildGraph([node("epic-01-a", "epic")], DEFAULT_TAXONOMY);

  assertThrows(
    () => setField(graph, "epic-01-a", "status", "complete", DEFAULT_TAXONOMY),
    MutationError,
  );
});

Deno.test("setField refuses a frozen (depended-upon) node", () => {
  const nodes = [
    node("masterplan-01-x", "masterplan", { children: ["epic-01-a"] }),
    node("epic-01-a", "epic", { parent: "masterplan-01-x" }),
  ];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  // The masterplan is frozen — its child derives from it (ADR-0002).
  const err = assertThrows(
    () => setField(graph, "masterplan-01-x", "owner", "justin", DEFAULT_TAXONOMY),
    MutationError,
  );
  assert(err.message.includes("frozen") || err.message.includes("supersede"));
});

Deno.test("setField allows editing a dependent node (child is workflow, not mandate)", () => {
  const nodes = [
    node("masterplan-01-x", "masterplan", { children: ["epic-01-a"] }),
    node("epic-01-a", "epic", { parent: "masterplan-01-x" }),
  ];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  const updated = setField(graph, "epic-01-a", "priority", "high", DEFAULT_TAXONOMY);

  assertEquals(updated.frontmatter.priority, "high");
});

Deno.test("addEdge wires both sides", () => {
  const nodes = [node("epic-01-a", "epic"), node("epic-02-b", "epic")];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  const updated = addEdge(graph, "epic-01-a", "blocks", "epic-02-b", DEFAULT_TAXONOMY);

  const a = updated.find((n) => n.id === "epic-01-a")!;
  const b = updated.find((n) => n.id === "epic-02-b")!;
  assertEquals(a.frontmatter.blocks, ["epic-02-b"]);
  assertEquals(b.frontmatter.blocked_by, ["epic-01-a"]);
});

Deno.test("addEdge reconciling the reverse of an existing edge is exempt from freeze and dependents", () => {
  // epic-02-b declares `blocked_by: epic-01-a`, but epic-01-a is missing the
  // reverse `blocks: epic-02-b`. epic-01-a is frozen (its workitem child
  // relies on it) AND has a dependent (the same child). Backfilling the
  // reverse is pure bookkeeping — exempt from BOTH the freeze and dependents
  // guards.
  const nodes = [
    node("masterplan-01-x", "masterplan", { children: ["epic-01-a"] }),
    node("epic-01-a", "epic", { parent: "masterplan-01-x", children: ["workitem-01-x"] }),
    node("workitem-01-x", "workitem", { parent: "epic-01-a" }),
    node("epic-02-b", "epic", { blocked_by: ["epic-01-a"] }),
  ];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  const updated = addEdge(graph, "epic-01-a", "blocks", "epic-02-b", DEFAULT_TAXONOMY);

  const a = updated.find((n) => n.id === "epic-01-a")!;
  assertEquals(a.frontmatter.blocks, ["epic-02-b"]);
});

Deno.test("addEdge of a genuinely new edge on a frozen node is still blocked", () => {
  // decision-01-old is frozen purely as a superseded historical record (no
  // dependents) — a genuinely new outbound edge on it must be refused.
  const nodes = [
    node("decision-02-new", "decision", {
      status: "accepted",
      supersedes: ["decision-01-old"],
    }),
    node("decision-01-old", "decision", {
      status: "superseded",
      superseded_by: ["decision-02-new"],
    }),
    node("epic-02-b", "epic"),
  ];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  const err = assertThrows(
    () => addEdge(graph, "decision-01-old", "blocks", "epic-02-b", DEFAULT_TAXONOMY),
    MutationError,
  );
  assert(err.message.includes("frozen") || err.message.includes("supersede"));
});

Deno.test("addEdge blocks a structural change when the source has dependents", () => {
  // epic-01-a already has a dependent (workitem child) -> structural change blocked.
  const nodes = [
    node("epic-01-a", "epic", { children: ["workitem-01-x"] }),
    node("workitem-01-x", "workitem", { parent: "epic-01-a" }),
    node("epic-02-b", "epic"),
  ];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  const err = assertThrows(
    () => addEdge(graph, "epic-01-a", "blocks", "epic-02-b", DEFAULT_TAXONOMY),
    MutationError,
  );
  assert(err.message.includes("workitem-01-x") || err.message.includes("supersede"));
});

Deno.test("addEdge of a weak (non-structural, non-freezing) edge on a frozen node succeeds", () => {
  // A masterplan frozen by its children should still accept `decisions` links —
  // they carry no meaning-lock semantics and must not require supersession.
  const nodes = [
    node("masterplan-01-mp", "masterplan", { children: ["workitem-01-wi"] }),
    node("workitem-01-wi", "workitem", { parent: "masterplan-01-mp" }),
    node("decision-01-d", "decision", { status: "accepted" }),
  ];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  const updated = addEdge(
    graph,
    "masterplan-01-mp",
    "decisions",
    "decision-01-d",
    DEFAULT_TAXONOMY,
  );
  const mp = updated.find((n) => n.id === "masterplan-01-mp")!;
  assertEquals(asList(mp.frontmatter.decisions), ["decision-01-d"]);
});

Deno.test("removeEdge clears both sides", () => {
  // epic-01-a is frozen ONLY by epic-02-b's reliance on it — the very
  // relationship being dissolved. The counterparty's freeze must not block
  // dissolving the relationship itself (same principle as the dependents
  // guard's `to` exclusion).
  const nodes = [
    node("epic-01-a", "epic", { blocks: ["epic-02-b"] }),
    node("epic-02-b", "epic", { blocked_by: ["epic-01-a"] }),
  ];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  const updated = removeEdge(graph, "epic-01-a", "blocks", "epic-02-b", DEFAULT_TAXONOMY);

  const a = updated.find((n) => n.id === "epic-01-a")!;
  const b = updated.find((n) => n.id === "epic-02-b")!;
  assertEquals(a.frontmatter.blocks ?? [], []);
  assertEquals(b.frontmatter.blocked_by ?? [], []);
});

Deno.test("removeEdge is still blocked when a third party freezes the source", () => {
  // epic-01-a blocks epic-02-b, but is ALSO superseded by another node —
  // frozen by a bystander, so even dissolving the a↔b relationship is refused.
  const nodes = [
    node("epic-01-a", "epic", {
      status: "superseded",
      blocks: ["epic-02-b"],
      superseded_by: ["epic-03-c"],
    }),
    node("epic-02-b", "epic", { blocked_by: ["epic-01-a"] }),
    node("epic-03-c", "epic", { supersedes: ["epic-01-a"] }),
  ];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  const err = assertThrows(
    () => removeEdge(graph, "epic-01-a", "blocks", "epic-02-b", DEFAULT_TAXONOMY),
    MutationError,
  );
  assert(err.message.includes("frozen") || err.message.includes("supersede"));
});

Deno.test("transitionStatus enforces the type's enum", () => {
  const graph = buildGraph([node("epic-01-a", "epic")], DEFAULT_TAXONOMY);

  const updated = transitionStatus(graph, "epic-01-a", "complete", DEFAULT_TAXONOMY);
  assertEquals(updated.frontmatter.status, "complete");

  assertThrows(
    () => transitionStatus(graph, "epic-01-a", "banana", DEFAULT_TAXONOMY),
    MutationError,
  );
});

Deno.test("transitionStatus is allowed on a frozen node — status is workflow, not mandate", () => {
  // An epic with children is frozen (depended upon), but completing it is a
  // workflow transition, not a meaning edit — it must not be freeze-guarded.
  const nodes = [
    node("epic-01-a", "epic", { children: ["workitem-01-x"] }),
    node("workitem-01-x", "workitem", { parent: "epic-01-a" }),
  ];
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);

  const updated = transitionStatus(graph, "epic-01-a", "complete", DEFAULT_TAXONOMY);

  assertEquals(updated.frontmatter.status, "complete");
});

Deno.test("transitionStatus refuses gate nodes (machine-owned by the runner)", () => {
  const graph = buildGraph([node("gate-01-g", "gate", { status: "open" })], DEFAULT_TAXONOMY);

  const err = assertThrows(
    () => transitionStatus(graph, "gate-01-g", "cleared", DEFAULT_TAXONOMY),
    MutationError,
  );
  assert(err.message.includes("gate run") || err.message.includes("runner"));
});
