/**
 * Node serialization: the inverse of {@link splitFrontmatter}.
 *
 * Renders a frontmatter mapping + prose body back to a markdown document with a
 * leading YAML block. Frontmatter ordering is normalized (scalars first, lists
 * last) per the design of record (control 3) — cosmetic, like `deno fmt`. This
 * is the single write-formatter every mutation command reuses, so on-disk
 * frontmatter is always consistently ordered regardless of who wrote it.
 *
 * @module
 */

import { stringify as stringifyYaml } from "@std/yaml";

/**
 * Serialize `frontmatter` + `body` into a markdown document. Scalar keys are
 * emitted before list keys; within each group, insertion order is preserved.
 * The result round-trips through {@link splitFrontmatter}.
 */
export function serializeNode(frontmatter: Record<string, unknown>, body: string): string {
  const ordered = orderForWrite(frontmatter);
  // The `core` schema mirrors the parser's: date-like strings (`2026-05-22`)
  // are emitted unquoted, byte-stable with the hand-authored form, instead of
  // being defensively quoted against a timestamp type Governor does not use.
  const yaml = stringifyYaml(ordered, { lineWidth: -1, schema: "core" }).trimEnd();
  return `---\n${yaml}\n---\n${body}`;
}

/**
 * Return a copy of `frontmatter` with scalar keys first and list (array) keys
 * last, preserving relative order within each group. `@std/yaml` honors object
 * key order on stringify, so this controls the on-disk layout.
 */
function orderForWrite(frontmatter: Record<string, unknown>): Record<string, unknown> {
  const scalars: Record<string, unknown> = {};
  const lists: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) lists[key] = value;
    else scalars[key] = value;
  }
  return { ...scalars, ...lists };
}
