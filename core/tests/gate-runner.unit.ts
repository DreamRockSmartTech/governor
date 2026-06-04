import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { runGate } from "../src/gate-runner.ts";
import type { GovNode } from "../src/types.ts";

function gate(fm: Record<string, unknown>): GovNode {
  return {
    id: "gate-01-g",
    uid: crypto.randomUUID(),
    nodeType: "gate",
    frontmatter: { id: "gate-01-g", node_type: "gate", status: "open", ...fm },
    body: "",
    path: "gate-01-g.md",
  };
}

async function rootWithScript(name: string, body: string): Promise<string> {
  const root = await Deno.makeTempDir({ prefix: "gov-gate-" });
  const path = join(root, name);
  await Deno.writeTextFile(path, body);
  await Deno.chmod(path, 0o755);
  return root;
}

Deno.test("runGate maps exit 0 to cleared", async () => {
  const root = await rootWithScript("pass.sh", "#!/bin/sh\nexit 0\n");
  const node = gate({
    criteria_check: { runnable: "pass.sh", description: "d", expectation: "e" },
  });

  const result = await runGate(node, root);

  assertEquals(result.status, "cleared");
  assertEquals(result.node.frontmatter.status, "cleared");
});

Deno.test("runGate resolves the runnable against the repo root (the cwd it is given)", async () => {
  // The script lives at the repo root and reads a repo-root file via cwd —
  // proving runnable + cwd are the passed root, not a nested governance dir.
  const repoRoot = await rootWithScript("proof.sh", "#!/bin/sh\ntest -f marker\n");
  await Deno.writeTextFile(join(repoRoot, "marker"), "x");
  const node = gate({
    criteria_check: { runnable: "proof.sh", description: "d", expectation: "e" },
  });

  const result = await runGate(node, repoRoot);

  assertEquals(result.status, "cleared");
});

Deno.test("runGate maps exit 1 to failed", async () => {
  const root = await rootWithScript("fail.sh", "#!/bin/sh\necho boom >&2\nexit 1\n");
  const node = gate({
    criteria_check: { runnable: "fail.sh", description: "d", expectation: "e" },
  });

  const result = await runGate(node, root);

  assertEquals(result.status, "failed");
  assertStringIncludes(result.output, "boom");
});

Deno.test("runGate flips a previously-cleared gate back to failed (bidirectional)", async () => {
  const root = await rootWithScript("fail.sh", "#!/bin/sh\nexit 1\n");
  const node = gate({
    status: "cleared",
    criteria_check: { runnable: "fail.sh", description: "d", expectation: "e" },
  });

  const result = await runGate(node, root);

  assertEquals(result.status, "failed");
});

Deno.test("runGate leaves the human-owned partial flag untouched", async () => {
  const root = await rootWithScript("fail.sh", "#!/bin/sh\nexit 1\n");
  const node = gate({
    partial: true,
    criteria_check: { runnable: "fail.sh", description: "d", expectation: "e" },
  });

  const result = await runGate(node, root);

  assertEquals(result.status, "failed");
  assertEquals(result.node.frontmatter.partial, true);
});
