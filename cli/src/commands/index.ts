/**
 * `governor index` — regenerate the INDEX view from the graph.
 *
 * By default the rendered markdown is printed to stdout (read-only). With
 * `--write` it overwrites `INDEX.md` at the root — the one generated-view write
 * this command performs, gated behind an explicit flag. The INDEX is never
 * hand-maintained; this command is its only author.
 *
 * @module
 */

import { join } from "@std/path";
import {
  buildGraph,
  DEFAULT_TAXONOMY,
  loadGovernance,
  renderIndex,
} from "@dreamrock/governor-core";

/** Options for the index command. */
export interface IndexOptions {
  /** Path to the `.governance/` root. */
  root: string;
  /** When true, overwrite `INDEX.md` instead of printing to stdout. */
  write: boolean;
}

/**
 * Run the index command. Prints the rendered INDEX to stdout, or writes it to
 * `<root>/INDEX.md` when `write` is set. Returns the exit code (always 0 on
 * success; load/IO errors throw).
 */
export async function runIndex(opts: IndexOptions): Promise<number> {
  const nodes = await loadGovernance(opts.root);
  const graph = buildGraph(nodes, DEFAULT_TAXONOMY);
  const markdown = renderIndex(graph, DEFAULT_TAXONOMY);

  if (opts.write) {
    const target = join(opts.root, "INDEX.md");
    await Deno.writeTextFile(target, markdown.endsWith("\n") ? markdown : markdown + "\n");
    console.log(`Wrote ${target}`);
  } else {
    console.log(markdown);
  }

  return 0;
}
