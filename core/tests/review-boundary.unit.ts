import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  appendTrailer,
  parseTrailer,
  reviewBoundary,
  type ReviewInput,
} from "../src/review-boundary.ts";

function input(over: Partial<ReviewInput> = {}): ReviewInput {
  return {
    stagedWorkItems: ["workitem-01-x"],
    message: "do the thing\n",
    churnLines: 10,
    churnThreshold: 400,
    ...over,
  };
}

Deno.test("one staged WorkItem passes and yields the binding trailer", () => {
  const r = reviewBoundary(input({ stagedWorkItems: ["workitem-07-parser"] }));

  assertEquals(r.action, "pass");
  assertEquals(r.bindingTrailer, "workitem-07-parser");
  assertStringIncludes(r.messageWithTrailer, "Governor-WorkItem: workitem-07-parser");
});

Deno.test("zero staged WorkItems blocks (code with no work-node)", () => {
  const r = reviewBoundary(input({ stagedWorkItems: [] }));

  assertEquals(r.action, "block");
  assert(r.findings.some((f) => f.code === "no-workitem"));
});

Deno.test("two staged WorkItems block, listing both", () => {
  const r = reviewBoundary(input({ stagedWorkItems: ["workitem-01-a", "workitem-02-b"] }));

  assertEquals(r.action, "block");
  const f = r.findings.find((f) => f.code === "multi-workitem")!;
  assertStringIncludes(f.message, "workitem-01-a");
  assertStringIncludes(f.message, "workitem-02-b");
});

Deno.test("multi-WorkItem with a valid Governor-Allow-Multi trailer passes (override on record)", () => {
  const r = reviewBoundary(input({
    stagedWorkItems: ["workitem-01-a", "workitem-02-b"],
    message: "bundle\n\nGovernor-Allow-Multi: coordinated refactor\n",
  }));

  assertEquals(r.action, "pass");
});

Deno.test("Governor-Allow-Multi with an empty reason still blocks", () => {
  const r = reviewBoundary(input({
    stagedWorkItems: ["workitem-01-a", "workitem-02-b"],
    message: "bundle\n\nGovernor-Allow-Multi:\n",
  }));

  assertEquals(r.action, "block");
});

Deno.test("churn over threshold on a single node warns but does not block", () => {
  const r = reviewBoundary(input({ churnLines: 900, churnThreshold: 400 }));

  assertEquals(r.action, "warn");
  assert(r.findings.some((f) => f.code === "scope-churn" && f.severity === "warn"));
});

Deno.test("parseTrailer extracts a trailer value, or null when absent", () => {
  assertEquals(parseTrailer("m\n\nGovernor-Allow-Multi: why\n", "Governor-Allow-Multi"), "why");
  assertEquals(parseTrailer("m\n", "Governor-Allow-Multi"), null);
});

Deno.test("appendTrailer is idempotent (no duplicate trailer line)", () => {
  const once = appendTrailer("m\n", "Governor-WorkItem", "workitem-01-x");
  const twice = appendTrailer(once, "Governor-WorkItem", "workitem-01-x");

  assertEquals(once, twice);
  assertEquals((twice.match(/Governor-WorkItem:/g) ?? []).length, 1);
});
