/**
 * Shared frontmatter field readers.
 *
 * The graph's edge values may be declared as a scalar or a list, and `status`
 * may be absent on non-node markdown — every consumer used to re-implement the
 * same normalizations. This module is their single home.
 *
 * @module
 */

import type { GovNode } from "./types.ts";

/** Normalize a frontmatter edge value (scalar, list, or absent) to a string list. */
export function asList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

/** Read a node's status string (`""` when the node or its status is absent). */
export function statusOf(node: GovNode | undefined): string {
  const s = node?.frontmatter.status;
  return typeof s === "string" ? s : "";
}

/**
 * Statuses that count as "done": a blocker in one of these no longer blocks.
 * `complete`/`closed` are the terminal work/plan states; `cleared` is the
 * terminal gate state.
 */
export const DONE_STATUSES: ReadonlySet<string> = new Set(["complete", "closed", "cleared"]);
