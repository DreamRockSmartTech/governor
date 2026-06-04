import { assertEquals } from "@std/assert";
import { exitCodeFor } from "../src/commands/check.ts";
import type { ValidationFinding } from "@dreamrock/governor-core";

const error: ValidationFinding = { severity: "error", code: "x", nodeId: "n", message: "m" };
const warn: ValidationFinding = { severity: "warn", code: "y", nodeId: "n", message: "m" };

Deno.test("exitCodeFor returns 0 for no findings", () => {
  assertEquals(exitCodeFor([]), 0);
});

Deno.test("exitCodeFor returns 0 when only warnings are present", () => {
  assertEquals(exitCodeFor([warn, warn]), 0);
});

Deno.test("exitCodeFor returns 1 when any error is present", () => {
  assertEquals(exitCodeFor([warn, error]), 1);
});
