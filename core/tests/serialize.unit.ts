import { assertEquals, assertStringIncludes } from "@std/assert";
import { serializeNode } from "../src/serialize.ts";
import { splitFrontmatter } from "../src/frontmatter.ts";

Deno.test("serializeNode emits a frontmatter block followed by the body", () => {
  const out = serializeNode({ id: "epic-01-x", node_type: "epic", status: "open" }, "# Body\n");

  assertStringIncludes(out, "---\n");
  assertStringIncludes(out, "id: epic-01-x");
  assertStringIncludes(out, "# Body");
});

Deno.test("serializeNode orders scalars before lists", () => {
  const out = serializeNode(
    { children: ["epic-01-x"], id: "masterplan-01-x", node_type: "masterplan", status: "open" },
    "",
  );

  const idPos = out.indexOf("id:");
  const statusPos = out.indexOf("status:");
  const childrenPos = out.indexOf("children:");

  // Scalars (id, status) must precede the list (children).
  assertEquals(idPos < childrenPos, true);
  assertEquals(statusPos < childrenPos, true);
});

Deno.test("serializeNode round-trips through splitFrontmatter", () => {
  const fm = {
    uid: "11111111-1111-1111-1111-111111111111",
    id: "epic-01-x",
    node_type: "epic",
    status: "open",
    blocks: ["epic-02-y"],
  };
  const body = "## Objective\n\nDo the thing.\n";

  const reparsed = splitFrontmatter(serializeNode(fm, body));

  assertEquals(reparsed.frontmatter, fm);
  assertEquals(reparsed.body, body);
});

Deno.test("a node with an unquoted date round-trips byte-stable through parse + serialize", () => {
  const fm = { id: "epic-01-a", node_type: "epic", created_at: "2026-05-22" };
  const out = serializeNode(fm, "Body.\n");
  const back = splitFrontmatter(out);
  assertEquals(back.frontmatter?.created_at, "2026-05-22");
  assertEquals(out.includes("created_at: 2026-05-22\n"), true);
});
