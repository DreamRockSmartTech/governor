/**
 * One-shot installer for the Governor agent skill.
 *
 * ```sh
 * deno run -A jsr:@dreamrock/governor-skill/install            # → .claude/skills/governor/
 * deno run -A jsr:@dreamrock/governor-skill/install --dest <dir>
 * ```
 *
 * Writes the packaged `SKILL.md` into the destination directory (default: the
 * Claude Code per-repo skills location). Re-running upgrades a stale copy and
 * leaves a current one untouched.
 *
 * @module
 */

import { parseArgs } from "@std/cli/parse-args";
import { installSkill } from "./mod.ts";

/** Default install location: the repository-local agent skills directory. */
export const DEFAULT_DEST = ".claude/skills/governor";

if (import.meta.main) {
  const flags = parseArgs(Deno.args, {
    string: ["dest"],
    default: { dest: DEFAULT_DEST },
  });

  const result = await installSkill(flags.dest);
  console.log(`${result.action}: ${result.path}`);
}
