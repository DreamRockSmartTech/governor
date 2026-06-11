import { assert, assertEquals } from "@std/assert";
import { DEFAULT_TAXONOMY } from "../src/taxonomy.ts";
import { buildGraph } from "../src/graph.ts";
import { stagedBoundary } from "../src/staged-check.ts";
import type { GovNode, Graph } from "../src/types.ts";

function node(id: string, nodeType: string, fm: Record<string, unknown> = {}, body = ""): GovNode {
  return {
    id,
    uid: `uid-${id}`,
    nodeType,
    frontmatter: { id, node_type: nodeType, status: fm.status ?? "open", ...fm },
    body,
    path: `${id}.md`,
  };
}

function graph(nodes: GovNode[]): Graph {
  return buildGraph(nodes, DEFAULT_TAXONOMY);
}

function codes(head: Graph, staged: Graph): string[] {
  return stagedBoundary(head, staged, DEFAULT_TAXONOMY).map((f) => f.code);
}

// epic-01-m is frozen at HEAD: its workitem child relies on it.
function frozenFixture(): GovNode[] {
  return [
    node("epic-01-m", "epic", { children: ["workitem-01-c"], title: "Mandate" }, "The mandate.\n"),
    node("workitem-01-c", "workitem", { parent: "epic-01-m", title: "Child" }, "Child body.\n"),
  ];
}

Deno.test("a status-only change on a frozen node passes (workflow exemption)", () => {
  const head = graph(frozenFixture());
  const staged = graph([
    node("epic-01-m", "epic", {
      status: "complete",
      children: ["workitem-01-c"],
      title: "Mandate",
    }, "The mandate.\n"),
    node("workitem-01-c", "workitem", { parent: "epic-01-m", title: "Child" }, "Child body.\n"),
  ]);

  assertEquals(codes(head, staged), []);
});

Deno.test("a body edit on a frozen node is blocked", () => {
  const head = graph(frozenFixture());
  const staged = graph([
    node("epic-01-m", "epic", { children: ["workitem-01-c"], title: "Mandate" }, "REWRITTEN.\n"),
    node("workitem-01-c", "workitem", { parent: "epic-01-m", title: "Child" }, "Child body.\n"),
  ]);

  assert(codes(head, staged).includes("frozen-body-edit"));
});

Deno.test("a plain-field edit on a frozen node is blocked", () => {
  const head = graph(frozenFixture());
  const staged = graph([
    node("epic-01-m", "epic", {
      children: ["workitem-01-c"],
      title: "Renamed Mandate",
    }, "The mandate.\n"),
    node("workitem-01-c", "workitem", { parent: "epic-01-m", title: "Child" }, "Child body.\n"),
  ]);

  assert(codes(head, staged).includes("frozen-node-edited"));
});

Deno.test("body and plain-field edits on an unfrozen node pass (prose is free-edit)", () => {
  const head = graph(frozenFixture());
  const staged = graph([
    node("epic-01-m", "epic", { children: ["workitem-01-c"], title: "Mandate" }, "The mandate.\n"),
    node("workitem-01-c", "workitem", {
      parent: "epic-01-m",
      title: "Child",
      priority: "high",
    }, "New session notes.\n"),
  ]);

  assertEquals(codes(head, staged), []);
});

Deno.test("deleting a frozen node is blocked", () => {
  const head = graph(frozenFixture());
  const staged = graph([
    node("workitem-01-c", "workitem", { parent: "epic-01-m", title: "Child" }, "Child body.\n"),
  ]);

  assert(codes(head, staged).includes("frozen-node-deleted"));
});

Deno.test("backfilling the reverse of an edge declared at HEAD passes (reconciliation)", () => {
  // workitem-01-c declared parent at HEAD, but epic-01-m never declared
  // children. Adding children on the frozen epic is pure bookkeeping.
  const head = graph([
    node("epic-01-m", "epic", { title: "Mandate" }),
    node("workitem-01-c", "workitem", { parent: "epic-01-m" }),
  ]);
  const staged = graph([
    node("epic-01-m", "epic", { title: "Mandate", children: ["workitem-01-c"] }),
    node("workitem-01-c", "workitem", { parent: "epic-01-m" }),
  ]);

  assertEquals(codes(head, staged), []);
});

Deno.test("wiring a brand-new staged child onto a frozen parent passes (creation path)", () => {
  const head = graph(frozenFixture());
  const staged = graph([
    node("epic-01-m", "epic", {
      children: ["workitem-01-c", "workitem-02-new"],
      title: "Mandate",
    }, "The mandate.\n"),
    node("workitem-01-c", "workitem", { parent: "epic-01-m", title: "Child" }, "Child body.\n"),
    node("workitem-02-new", "workitem", { parent: "epic-01-m", title: "New" }),
  ]);

  assertEquals(codes(head, staged), []);
});

Deno.test("a symmetric hand-added edge pair passes when one direction is CLI-legal", () => {
  // Both nodes clean at HEAD: `governor edge add` could have produced this.
  const head = graph([node("epic-01-a", "epic"), node("epic-02-b", "epic")]);
  const staged = graph([
    node("epic-01-a", "epic", { blocks: ["epic-02-b"] }),
    node("epic-02-b", "epic", { blocked_by: ["epic-01-a"] }),
  ]);

  assertEquals(codes(head, staged), []);
});

Deno.test("a symmetric hand-added edge pair is blocked when no CLI direction was legal", () => {
  // Both endpoints are frozen by third parties at HEAD — the CLI would have
  // refused this edge in either direction, so a symmetric hand edit is the
  // control-5 keystone case and must fail.
  const head = graph([
    node("epic-01-a", "epic", { children: ["workitem-01-x"] }),
    node("workitem-01-x", "workitem", { parent: "epic-01-a" }),
    node("epic-02-b", "epic", { children: ["workitem-02-y"] }),
    node("workitem-02-y", "workitem", { parent: "epic-02-b" }),
  ]);
  const staged = graph([
    node("epic-01-a", "epic", { children: ["workitem-01-x"], blocks: ["epic-02-b"] }),
    node("workitem-01-x", "workitem", { parent: "epic-01-a" }),
    node("epic-02-b", "epic", { children: ["workitem-02-y"], blocked_by: ["epic-01-a"] }),
    node("workitem-02-y", "workitem", { parent: "epic-02-b" }),
  ]);

  assert(codes(head, staged).includes("out-of-band-structural"));
});

Deno.test("removing an edge pair passes when one direction is CLI-legal", () => {
  // A is frozen only by B (the relationship being dissolved) — the CLI's
  // counterparty exclusion permits `edge rm`.
  const head = graph([
    node("epic-01-a", "epic", { blocks: ["epic-02-b"] }),
    node("epic-02-b", "epic", { blocked_by: ["epic-01-a"] }),
  ]);
  const staged = graph([node("epic-01-a", "epic"), node("epic-02-b", "epic")]);

  assertEquals(codes(head, staged), []);
});

Deno.test("removing an edge pair is blocked when bystanders still rely on both ends", () => {
  const head = graph([
    node("epic-01-a", "epic", { blocks: ["epic-02-b"], children: ["workitem-01-x"] }),
    node("workitem-01-x", "workitem", { parent: "epic-01-a" }),
    node("epic-02-b", "epic", { blocked_by: ["epic-01-a"], children: ["workitem-02-y"] }),
    node("workitem-02-y", "workitem", { parent: "epic-02-b" }),
  ]);
  const staged = graph([
    node("epic-01-a", "epic", { children: ["workitem-01-x"] }),
    node("workitem-01-x", "workitem", { parent: "epic-01-a" }),
    node("epic-02-b", "epic", { children: ["workitem-02-y"] }),
    node("workitem-02-y", "workitem", { parent: "epic-02-b" }),
  ]);

  assert(codes(head, staged).includes("out-of-band-structural"));
});

Deno.test("a criteria_check change on a gate with dependents is blocked; on a fresh gate it passes", () => {
  const head = graph([
    node("gate-01-g", "gate", {
      criteria_check: { runnable: "check.sh" },
      blocks: ["epic-01-a"],
    }),
    node("epic-01-a", "epic", { blocked_by: ["gate-01-g"] }),
    node("gate-02-fresh", "gate", { criteria_check: { runnable: "old.sh" } }),
  ]);
  const staged = graph([
    node("gate-01-g", "gate", {
      criteria_check: { runnable: "weakened.sh" },
      blocks: ["epic-01-a"],
    }),
    node("epic-01-a", "epic", { blocked_by: ["gate-01-g"] }),
    node("gate-02-fresh", "gate", { criteria_check: { runnable: "new.sh" } }),
  ]);

  const found = stagedBoundary(head, staged, DEFAULT_TAXONOMY);
  assertEquals(found.filter((f) => f.code === "out-of-band-structural").length, 1);
  assertEquals(found[0].nodeId, "gate-01-g");
});
