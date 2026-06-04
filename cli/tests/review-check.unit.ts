import { assertEquals } from "@std/assert";
import { stagedWorkItemIds } from "../src/commands/review-check.ts";

Deno.test("stagedWorkItemIds extracts workitem ids and ignores non-workitem paths", () => {
  const paths = [
    ".governance/workitems/workitem-12-parser.md",
    ".governance/epics/epic-01-x.md",
    "src/main.ts",
    ".governance/workitems/workitem-03-foo-bar.md",
  ];

  assertEquals(stagedWorkItemIds(paths), ["workitem-12-parser", "workitem-03-foo-bar"]);
});

Deno.test("stagedWorkItemIds dedups a workitem touched via multiple paths", () => {
  const paths = [
    ".governance/workitems/workitem-12-parser.md",
    "./.governance/workitems/workitem-12-parser.md",
  ];

  assertEquals(stagedWorkItemIds(paths), ["workitem-12-parser"]);
});
