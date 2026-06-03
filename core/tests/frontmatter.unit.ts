import { assertEquals, assertNotEquals } from "@std/assert";
import { type ParsedDocument, splitFrontmatter } from "../src/frontmatter.ts";

Deno.test("splitFrontmatter parses scalar and list frontmatter into typed body+map", () => {
  const source = [
    "---",
    "id: epic-24-permission-mcp",
    "node_type: epic",
    "revision: 1",
    "blocks:",
    "  - epic-25-observability-wiring",
    "---",
    "",
    "## Objective",
    "",
    "Build the thing.",
    "",
  ].join("\n");

  const result: ParsedDocument = splitFrontmatter(source);

  assertNotEquals(result.frontmatter, null);
  const fm = result.frontmatter!;
  assertEquals(fm.id, "epic-24-permission-mcp");
  assertEquals(fm.node_type, "epic");
  assertEquals(fm.revision, 1);
  assertEquals(fm.blocks, ["epic-25-observability-wiring"]);
  assertEquals(result.body, "\n## Objective\n\nBuild the thing.\n");
});

Deno.test("splitFrontmatter returns null frontmatter for a file with no block", () => {
  const source = "# ISA Format Specification\n\nNo frontmatter here.\n";

  const result = splitFrontmatter(source);

  assertEquals(result.frontmatter, null);
  assertEquals(result.body, source);
});

Deno.test("splitFrontmatter preserves a body that itself contains '---' rules", () => {
  const source = [
    "---",
    "id: workitem-01-x",
    "---",
    "Intro paragraph.",
    "",
    "---",
    "",
    "After the horizontal rule.",
    "",
  ].join("\n");

  const result = splitFrontmatter(source);

  assertEquals(result.frontmatter?.id, "workitem-01-x");
  assertEquals(
    result.body,
    "Intro paragraph.\n\n---\n\nAfter the horizontal rule.\n",
  );
});
