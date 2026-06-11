/**
 * Governor Skill — the agent-facing cooperative layer of the Governor
 * governance toolkit (the defense-in-depth companion to the enforcing hooks;
 * see DESIGN.md control 6).
 *
 * The deliverable is a skill directory: `SKILL.md` (the lean core — workflow
 * phases, the two structural rules, the hook playbook) plus `references/`
 * (progressive-disclosure depth: the full interview methodology, the CLI
 * recipes, and the `.governance/` structure map an agent loads on demand).
 *
 * This module is the programmatic surface: read the skill text or install the
 * full directory into a repository's agent-skills location. The `./install`
 * export is the one-shot CLI: `deno run -A jsr:@dreamrock/governor-skill/install`.
 *
 * @module
 */

import { dirname, join } from "@std/path";

/**
 * Every file the skill ships, relative to the skill root. `SKILL.md` is the
 * entry point; the references are loaded by the agent on demand.
 */
export const SKILL_FILES: readonly string[] = [
  "SKILL.md",
  "references/interview.md",
  "references/cli.md",
  "references/structure.md",
];

/** What happened to one installed file. */
export type FileAction = "created" | "updated" | "unchanged";

/** Result of an {@link installSkill} run. */
export interface InstallResult {
  /** The destination skill directory. */
  path: string;
  /** Aggregate outcome: `unchanged` only when every file was already current. */
  action: FileAction;
  /** Per-file outcomes, in {@link SKILL_FILES} order. */
  files: { path: string; action: FileAction }[];
}

/**
 * The full `SKILL.md` source shipped by this package (frontmatter + body).
 * Resolved relative to the module so it works from JSR and local checkouts.
 */
export async function skillText(): Promise<string> {
  return await fileText("SKILL.md");
}

/** The source of any packaged skill file (a {@link SKILL_FILES} entry). */
export async function fileText(relPath: string): Promise<string> {
  const response = await fetch(import.meta.resolve(`./${relPath}`));
  return await response.text();
}

/**
 * Install the skill directory into `destDir` (created if absent). Idempotent:
 * up-to-date files are left untouched; stale ones are overwritten — the
 * installed copy is generated content, owned by this package, like a hook
 * engine layer. Local customization belongs in a separate skill, not in edits
 * to these files.
 */
export async function installSkill(destDir: string): Promise<InstallResult> {
  const files: { path: string; action: FileAction }[] = [];

  for (const rel of SKILL_FILES) {
    const path = join(destDir, rel);
    const content = await fileText(rel);

    let existing: string | null = null;
    try {
      existing = await Deno.readTextFile(path);
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    }

    if (existing === content) {
      files.push({ path, action: "unchanged" });
      continue;
    }
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeTextFile(path, content);
    files.push({ path, action: existing === null ? "created" : "updated" });
  }

  return { path: destDir, action: aggregate(files), files };
}

/** Fold per-file outcomes into one: any write wins over `unchanged`. */
function aggregate(files: { action: FileAction }[]): FileAction {
  if (files.every((f) => f.action === "unchanged")) return "unchanged";
  if (files.every((f) => f.action === "created")) return "created";
  return "updated";
}

/** Current package version. Kept in sync with the `version` field in deno.json. */
export const VERSION: string = "0.1.0";
