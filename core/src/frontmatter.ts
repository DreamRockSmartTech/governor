/**
 * Frontmatter splitting: separate a markdown document into its leading YAML
 * frontmatter block and the prose body below it.
 *
 * This module holds no schema opinion — it returns the raw parsed YAML mapping
 * and the verbatim body. Schema validation is the validator's job. YAML parsing
 * is delegated to the Deno standard library rather than hand-rolled.
 *
 * @module
 */

import { parse as parseYaml } from "@std/yaml";

/** Result of splitting a markdown document. */
export interface ParsedDocument {
  /**
   * The parsed frontmatter mapping, or `null` when the document has no
   * frontmatter block (e.g. a reference file like `ISA-FORMAT.md`).
   */
  frontmatter: Record<string, unknown> | null;
  /** The prose body below the frontmatter (or the whole file if none). */
  body: string;
}

/** Matches a leading `---\n…\n---\n` frontmatter block at the very start. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Split `source` into frontmatter and body. A frontmatter block must be the very
 * first thing in the file, delimited by `---` lines; only the first such block
 * is consumed, so `---` horizontal rules in the body are preserved. Returns a
 * `null` frontmatter when no leading block is present.
 */
export function splitFrontmatter(source: string): ParsedDocument {
  const match = source.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: null, body: source };
  }

  const yamlText = match[1];
  // The `core` schema keeps unquoted dates (`2026-05-22`) as plain strings.
  // The default schema would coerce them to Date objects, which re-serialize
  // as ISO timestamps and corrupt every node a write command touches.
  const parsed = parseYaml(yamlText, { schema: "core" });
  const frontmatter = isMapping(parsed) ? parsed : {};
  const body = source.slice(match[0].length);
  return { frontmatter, body };
}

/** Narrow an unknown YAML value to a string-keyed mapping. */
function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
