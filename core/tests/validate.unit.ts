import { assert, assertEquals } from "@std/assert";
import { DEFAULT_TAXONOMY } from "../src/taxonomy.ts";
import { buildGraph } from "../src/graph.ts";
import { validate } from "../src/validate.ts";
import type { GovNode } from "../src/types.ts";

function node(id: string, nodeType: string, fm: Record<string, unknown> = {}): GovNode {
  return {
    id,
    uid: typeof fm.uid === "string" ? fm.uid : crypto.randomUUID(),
    nodeType,
    frontmatter: { id, node_type: nodeType, status: defaultStatus(nodeType), ...fm },
    body: "",
    path: `${id}.md`,
  };
}

function defaultStatus(nodeType: string): string {
  return nodeType === "decision" ? "accepted" : nodeType === "index" ? "active" : "open";
}

function codes(nodes: GovNode[]): string[] {
  const g = buildGraph(nodes, DEFAULT_TAXONOMY);
  return validate(g, DEFAULT_TAXONOMY).map((f) => f.code);
}

Deno.test("validate passes a clean two-node graph with no findings", () => {
  const nodes = [
    node("masterplan-01-x", "masterplan", { children: ["epic-01-a"] }),
    node("epic-01-a", "epic", { parent: "masterplan-01-x" }),
  ];
  const g = buildGraph(nodes, DEFAULT_TAXONOMY);
  const errors = validate(g, DEFAULT_TAXONOMY).filter((f) => f.severity === "error");
  assertEquals(errors, []);
});

Deno.test("validate flags an id prefix that disagrees with node_type", () => {
  const nodes = [node("epic-01-a", "workitem")];
  assert(codes(nodes).includes("id-prefix-mismatch"));
});

Deno.test("validate accepts an aliased prefix (charter -> project)", () => {
  const nodes = [node("charter-h3g", "project")];
  const found = codes(nodes);
  assertEquals(found.includes("id-prefix-mismatch"), false);
});

Deno.test("validate flags an unknown node_type", () => {
  const nodes = [node("widget-01-x", "widget")];
  assert(codes(nodes).includes("unknown-node-type"));
});

Deno.test("validate flags a status outside the type's enum", () => {
  const nodes = [node("epic-01-a", "epic", { status: "banana" })];
  assert(codes(nodes).includes("invalid-status"));
});

Deno.test("validate flags a malformed id slug", () => {
  const nodes = [node("epic-bad-slug", "epic")];
  assert(codes(nodes).includes("malformed-id"));
});

Deno.test("validate flags a duplicate {NN} within a node type", () => {
  const nodes = [
    node("epic-01-a", "epic"),
    node("epic-01-b", "epic"),
  ];
  assert(codes(nodes).includes("duplicate-number"));
});

Deno.test("validate flags a missing or malformed uid", () => {
  const nodes = [node("epic-01-a", "epic", { uid: "not-a-uuid" })];
  assert(codes(nodes).includes("invalid-uid"));
});

Deno.test("validate flags a dangling structural edge target", () => {
  const nodes = [node("epic-01-a", "epic", { parent: "masterplan-99-ghost" })];
  assert(codes(nodes).includes("dangling-edge"));
});

Deno.test("validate flags asymmetric structural edges (hand-edit drift)", () => {
  // masterplan declares children: [epic] but epic omits parent -> the reverse
  // is derived in-memory; the validator must flag the missing declaration.
  const nodes = [
    node("masterplan-01-x", "masterplan", { children: ["epic-01-a"] }),
    node("epic-01-a", "epic"),
  ];
  assert(codes(nodes).includes("asymmetric-edge"));
});

Deno.test("validate enforces symmetry on the produces_gate/guarded_by pair", () => {
  // The epic declares produces_gate but the gate is missing guarded_by — the
  // same hand-edit drift the parent/children pair catches.
  const nodes = [
    node("epic-01-a", "epic", { produces_gate: ["gate-01-g"] }),
    node("gate-01-g", "gate"),
  ];
  assert(codes(nodes).includes("asymmetric-edge"));
});

Deno.test("validate accepts a symmetric produces_gate/guarded_by pair", () => {
  const nodes = [
    node("epic-01-a", "epic", { produces_gate: ["gate-01-g"] }),
    node("gate-01-g", "gate", { guarded_by: ["epic-01-a"] }),
  ];
  assertEquals(codes(nodes).filter((c) => c === "asymmetric-edge"), []);
});

Deno.test("validate flags a dangling consumes_gate reference", () => {
  const nodes = [node("epic-01-a", "epic", { consumes_gate: ["gate-09-ghost"] })];
  assert(codes(nodes).includes("dangling-edge"));
});

Deno.test("validate does not require a reverse for weak reference kinds", () => {
  // decisions / cited_by / gates / consumes_gate are recognized one-way
  // references: dangling targets are flagged, but no reverse is demanded.
  const nodes = [
    node("masterplan-01-m", "masterplan", {
      gates: ["gate-01-g"],
      decisions: ["decision-01-d"],
    }),
    node("gate-01-g", "gate", { cited_by: ["decision-01-d"] }),
    node("decision-01-d", "decision"),
  ];
  assertEquals(codes(nodes).filter((c) => c === "asymmetric-edge"), []);
});

Deno.test("validate warns on a legacy prose criteria_check (gate runner would fail closed)", () => {
  const nodes = [
    node("gate-01-legacy", "gate", { criteria_check: "deno task test (suite 816/0)" }),
    node("gate-02-ok", "gate", {
      criteria_check: { runnable: "checks/g2.sh", description: "d", expectation: "e" },
    }),
    node("gate-03-none", "gate"),
  ];
  const g = buildGraph(nodes, DEFAULT_TAXONOMY);
  const findings = validate(g, DEFAULT_TAXONOMY);

  const legacy = findings.filter((f) => f.code === "legacy-criteria-check");
  assertEquals(legacy.length, 1);
  assertEquals(legacy[0].nodeId, "gate-01-legacy");
  assertEquals(legacy[0].severity, "warn");
});

Deno.test("validate does not require a reverse for one-way cites edges", () => {
  const nodes = [
    node("epic-01-a", "epic", { cites: ["decision-00-x"] }),
    node("decision-00-x", "decision"),
  ];
  assertEquals(codes(nodes).includes("asymmetric-edge"), false);
});
