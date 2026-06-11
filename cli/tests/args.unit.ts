import { assert, assertEquals } from "@std/assert";
import { dispatch } from "../src/args.ts";

Deno.test("dispatch rejects an unknown edge op instead of silently adding", async () => {
  // `edge remove` is not a verb (`rm` is); it must error out before touching
  // any tree, not fall through to `add`.
  const errors: string[] = [];
  const original = console.error;
  console.error = (msg: unknown) => errors.push(String(msg));
  try {
    const code = await dispatch(["edge", "remove", "a", "blocks", "b"], "test");
    assertEquals(code, 1);
    assert(errors.some((e) => e.includes("remove")), "error must name the bad op");
  } finally {
    console.error = original;
  }
});

Deno.test("dispatch accepts the add and rm edge ops", async () => {
  // Both verbs reach the command (which then fails on the nonexistent root —
  // proving they were not rejected at the parse layer).
  for (const op of ["add", "rm"]) {
    let failed = false;
    try {
      await dispatch(["edge", op, "a", "blocks", "b", "--root", "/nonexistent-gov"], "test");
    } catch {
      failed = true; // loadTree on a missing root throws — expected
    }
    assert(failed, `${op} should have reached the command and failed on the missing root`);
  }
});
