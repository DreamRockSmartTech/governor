import { assert, assertEquals } from "@std/assert";
import { DEFAULT_TAXONOMY } from "../src/taxonomy.ts";
import { blastRadius, buildGraph } from "../src/graph.ts";
import type { GovNode } from "../src/types.ts";

function node(id: string, nodeType: string, fm: Record<string, unknown> = {}): GovNode {
  return {
    id,
    uid: `uid-${id}`,
    nodeType,
    frontmatter: { id, node_type: nodeType, ...fm },
    body: "",
    path: `${id}.md`,
  };
}

/**
 * Fixture: masterplan ← epic-A (blocks epic-B) ← workitem-X.
 * mp --children--> epicA ; epicA --blocks--> epicB ; epicA --children--> wiX.
 */
function fixture(): GovNode[] {
  return [
    node("masterplan-01-x", "masterplan", { children: ["epic-01-a"] }),
    node("epic-01-a", "epic", {
      parent: "masterplan-01-x",
      blocks: ["epic-02-b"],
      children: ["workitem-01-x"],
    }),
    node("epic-02-b", "epic", { blocked_by: ["epic-01-a"] }),
    node("workitem-01-x", "workitem", { parent: "epic-01-a" }),
  ];
}

Deno.test("buildGraph indexes nodes by id and uid", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  assertEquals(g.byId.size, 4);
  assertEquals(g.byUid.get("uid-epic-01-a")?.id, "epic-01-a");
});

Deno.test("buildGraph materializes declared edges and derives missing reverses", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  // epic-01-a declares children: [workitem-01-x] but workitem only declares
  // parent — so the children->parent reverse on the workitem is derived.
  const derivedParent = g.edges.find((e) =>
    e.kind === "parent" && e.from === "workitem-01-x" && e.to === "epic-01-a"
  );
  assert(derivedParent, "expected a parent edge from workitem to epic");

  // The blocks/blocked_by pair is declared on both sides — neither is derived.
  const declaredBlocks = g.edges.find((e) =>
    e.kind === "blocks" && e.from === "epic-01-a" && e.to === "epic-02-b"
  );
  assertEquals(declaredBlocks?.derived, false);
});

Deno.test("blastRadius (structural) follows structural edges downstream transitively", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  const downstream = blastRadius(g, "masterplan-01-x", "structural").sort();

  // From the masterplan, structural reach: epicA (child), epicB (epicA blocks),
  // workitemX (epicA child).
  assertEquals(downstream, ["epic-01-a", "epic-02-b", "workitem-01-x"]);
});

Deno.test("blastRadius excludes the origin node itself", () => {
  const g = buildGraph(fixture(), DEFAULT_TAXONOMY);

  const downstream = blastRadius(g, "epic-02-b", "structural");

  assertEquals(downstream.includes("epic-02-b"), false);
});
