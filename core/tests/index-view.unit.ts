import { assertStringIncludes } from "@std/assert";
import { DEFAULT_TAXONOMY } from "../src/taxonomy.ts";
import { buildGraph } from "../src/graph.ts";
import { renderIndex } from "../src/index-view.ts";
import type { GovNode } from "../src/types.ts";

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

function sampleGraph() {
  const nodes = [
    node("charter-h3g", "project", {
      status: "active",
      title: "H3G",
      children: ["masterplan-01-x"],
    }),
    node("masterplan-01-x", "masterplan", { title: "Core Build", status: "complete" }),
    node("masterplan-02-y", "masterplan", { title: "Gap Closure", status: "open" }),
    node("epic-01-a", "epic"),
    node("epic-02-b", "epic"),
    node("gate-01-g", "gate", { status: "cleared" }),
  ];
  return buildGraph(nodes, DEFAULT_TAXONOMY);
}

Deno.test("renderIndex tallies a count row per populated node-type bucket", () => {
  const out = renderIndex(sampleGraph(), DEFAULT_TAXONOMY);

  // Two masterplans, two epics, one gate present.
  assertStringIncludes(out, "| masterplan | 2 |");
  assertStringIncludes(out, "| epic | 2 |");
  assertStringIncludes(out, "| gate | 1 |");
});

Deno.test("renderIndex lists each masterplan with its title and status", () => {
  const out = renderIndex(sampleGraph(), DEFAULT_TAXONOMY);

  assertStringIncludes(out, "[[masterplan-01-x]] — Core Build (complete)");
  assertStringIncludes(out, "[[masterplan-02-y]] — Gap Closure (open)");
});

Deno.test("renderIndex names the project root", () => {
  const out = renderIndex(sampleGraph(), DEFAULT_TAXONOMY);

  assertStringIncludes(out, "[[charter-h3g]]");
});
