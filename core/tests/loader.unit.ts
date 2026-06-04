import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadGovernance } from "../src/loader.ts";

const TESTDATA = fromFileUrl(import.meta.resolve("./testdata/valid"));

Deno.test("loadGovernance loads every node and skips non-node files", async () => {
  const nodes = await loadGovernance(TESTDATA);

  const ids = nodes.map((n) => n.id).sort();
  assertEquals(ids, ["epic-01-sample", "masterplan-01-sample"]);
});

Deno.test("loadGovernance populates typed node fields from frontmatter", async () => {
  const nodes = await loadGovernance(TESTDATA);
  const epic = nodes.find((n) => n.id === "epic-01-sample")!;

  assertEquals(epic.uid, "11111111-1111-1111-1111-111111111111");
  assertEquals(epic.nodeType, "epic");
  assertEquals(epic.frontmatter.status, "open");
  assertEquals(epic.frontmatter.parent, "masterplan-01-sample");
});
