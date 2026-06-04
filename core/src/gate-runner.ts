/**
 * The gate-proof runner (design of record, control 2).
 *
 * A gate's `criteria_check.runnable` is executed; its exit code decides the
 * gate's machine-owned `status`: exit 0 → `cleared`, non-zero → `failed`. The
 * mapping is bidirectional — a previously-cleared gate whose check now fails
 * flips back to `failed`. The human-owned `partial` bypass flag is never touched.
 *
 * This is the only module that shells out. It is fail-closed: a missing or
 * malformed `criteria_check.runnable` is a `failed`, never a silent pass.
 *
 * @module
 */

import { join } from "@std/path";
import type { GovNode } from "./types.ts";

/** Outcome of running a gate's proof. */
export interface GateResult {
  /** The machine-owned status written: `cleared` (exit 0) or `failed`. */
  status: "cleared" | "failed";
  /** Combined stdout+stderr from the runnable, for the operator. */
  output: string;
  /** The gate node with its `status` updated (ready to persist). */
  node: GovNode;
}

/**
 * Run `gate`'s `criteria_check.runnable` with the tree `root` as cwd, map the
 * exit code to a status, and return the updated node. The runnable path is
 * resolved relative to `root`. A gate with no runnable fails closed.
 */
export async function runGate(gate: GovNode, root: string): Promise<GateResult> {
  const runnable = readRunnable(gate);
  if (!runnable) {
    return finish(gate, "failed", "no criteria_check.runnable defined");
  }

  try {
    const command = new Deno.Command(join(root, runnable), {
      cwd: root,
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    return finish(gate, code === 0 ? "cleared" : "failed", output);
  } catch (err) {
    return finish(gate, "failed", `runnable could not be executed: ${(err as Error).message}`);
  }
}

/** Extract `criteria_check.runnable` if present and a string. */
function readRunnable(gate: GovNode): string | null {
  const check = gate.frontmatter.criteria_check;
  if (typeof check !== "object" || check === null) return null;
  const runnable = (check as Record<string, unknown>).runnable;
  return typeof runnable === "string" ? runnable : null;
}

/** Build the result with the gate's status updated (partial left untouched). */
function finish(gate: GovNode, status: "cleared" | "failed", output: string): GateResult {
  const node: GovNode = {
    ...gate,
    frontmatter: { ...gate.frontmatter, status },
  };
  return { status, output, node };
}
