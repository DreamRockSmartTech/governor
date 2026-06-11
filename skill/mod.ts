/**
 * Governor Skill — the agent-facing cooperative layer of the Governor
 * governance toolkit (the defense-in-depth companion to the enforcing hooks;
 * see DESIGN.md control 6).
 *
 * The deliverable is `SKILL.md`: instructions that teach a coding agent the
 * governance-driven workflow — synchronize with the user through an
 * adversarial design interview, encode the agreed work as governance nodes via
 * the `governor` CLI, track sessions in free-edit prose, and finish through
 * gates with one WorkItem per commit.
 *
 * This module is the programmatic surface: read the skill text or install it
 * into a repository's agent-skills directory. The `./install` export is the
 * one-shot CLI: `deno run -A jsr:@dreamrock/governor-skill/install`.
 *
 * @module
 */

import { dirname, join } from "@std/path";

/** Result of an {@link installSkill} run. */
export interface InstallResult {
  /** Absolute path of the installed `SKILL.md`. */
  path: string;
  /** What happened: written fresh, overwritten with new content, or already current. */
  action: "created" | "updated" | "unchanged";
}

/**
 * The full `SKILL.md` source shipped by this package (frontmatter + body).
 * Resolved relative to the module so it works from JSR and local checkouts.
 */
export async function skillText(): Promise<string> {
  const response = await fetch(import.meta.resolve("./SKILL.md"));
  return await response.text();
}

/**
 * Install `SKILL.md` into `destDir` (created if absent). Idempotent: an
 * up-to-date file is left untouched; a stale one is overwritten — the
 * installed copy is generated content, owned by this package, like a hook
 * engine layer. Local customization belongs in a separate skill, not in edits
 * to this file.
 */
export async function installSkill(destDir: string): Promise<InstallResult> {
  const path = join(destDir, "SKILL.md");
  const content = await skillText();

  let existing: string | null = null;
  try {
    existing = await Deno.readTextFile(path);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  if (existing === content) return { path, action: "unchanged" };

  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, content);
  return { path, action: existing === null ? "created" : "updated" };
}

/** Current package version. Kept in sync with the `version` field in deno.json. */
export const VERSION: string = "0.0.1";
