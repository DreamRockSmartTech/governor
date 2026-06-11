import { assert, assertEquals } from "@std/assert";
import { asList, DONE_STATUSES, statusOf } from "../src/fields.ts";
import type { GovNode } from "../src/types.ts";

function node(status?: unknown): GovNode {
  return {
    id: "workitem-01-x",
    uid: "uid-x",
    nodeType: "workitem",
    frontmatter: status === undefined ? {} : { status },
    body: "",
    path: "x.md",
  };
}

Deno.test("asList normalizes scalar, list, and absent frontmatter values", () => {
  assertEquals(asList("epic-01-a"), ["epic-01-a"]);
  assertEquals(asList(["a", "b"]), ["a", "b"]);
  assertEquals(asList(["a", 7, "b"]), ["a", "b"]); // non-strings dropped
  assertEquals(asList(undefined), []);
  assertEquals(asList(42), []);
});

Deno.test("statusOf reads a node's status, empty for absent/missing/non-string", () => {
  assertEquals(statusOf(node("open")), "open");
  assertEquals(statusOf(node(7)), "");
  assertEquals(statusOf(node()), "");
  assertEquals(statusOf(undefined), "");
});

Deno.test("DONE_STATUSES covers exactly the terminal work/gate states", () => {
  assertEquals([...DONE_STATUSES].sort(), ["cleared", "closed", "complete"]);
  assert(DONE_STATUSES.has("complete"));
  assert(!DONE_STATUSES.has("open"));
});
