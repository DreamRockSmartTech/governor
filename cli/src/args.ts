/**
 * Argument parsing and subcommand dispatch for the Governor CLI.
 *
 * A thin layer over the standard `parseArgs`: it resolves the subcommand and
 * its options, then delegates to the command runners. Help text lives here so
 * the command surface is described in one place.
 *
 * @module
 */

import { parseArgs } from "@std/cli/parse-args";
import { runInit } from "./commands/init.ts";
import { runCheck } from "./commands/check.ts";
import { runIndex } from "./commands/index.ts";
import { runNew } from "./commands/new.ts";
import { runSet } from "./commands/set.ts";
import { runEdge } from "./commands/edge.ts";
import { runStatus } from "./commands/status.ts";
import { runGateCommand } from "./commands/gate.ts";

const DEFAULT_ROOT = ".governance";

/** Edge-kind flags accepted by `new` to declare an edge at creation time. */
const EDGE_FLAGS = ["parent", "blocks", "blocked_by", "supersedes", "superseded_by", "cites"];

/** Top-level `--help` text describing the command surface. */
export const HELP = `governor — git-native governance toolkit

Setup:
  governor init [--root <path>]              Install git hooks + assert signing mandate

Read:
  governor check [--root <path>] [--json]    Validate a .governance/ tree
  governor index [--root <path>] [--write]   Regenerate the INDEX view

Write (plumbing):
  governor new <type> --title <t> [--parent <id> | --blocks <id> | …]
                                             Create + initialize a node
  governor set <id> <field> <value>          Set a plain frontmatter scalar
  governor edge add|rm <from> <kind> <to>    Add/remove a structural edge
  governor status <id> <new-status>          Transition a work/plan status
  governor gate run <id> | --all             Run a gate's proof; write status

  governor version                           Print the version
  governor --help                            Show this help

Options:
  --root <path>   Path to the .governance/ root (default: ${DEFAULT_ROOT})`;

/**
 * Parse `argv` and run the selected subcommand. Returns the process exit code.
 * Unknown or missing subcommands print help and return a non-zero code.
 */
export async function dispatch(argv: string[], version: string): Promise<number> {
  const flags = parseArgs(argv, {
    boolean: ["json", "write", "help", "all"],
    string: ["root", "title", ...EDGE_FLAGS],
    default: { root: DEFAULT_ROOT },
  });

  const positional = flags._.map(String);
  const command = positional[0];

  if (flags.help || command === undefined) {
    console.log(HELP);
    return command === undefined ? 1 : 0;
  }

  switch (command) {
    case "init":
      return await runInit({ root: flags.root });
    case "check":
      return await runCheck({ root: flags.root, json: Boolean(flags.json) });
    case "index":
      return await runIndex({ root: flags.root, write: Boolean(flags.write) });
    case "new":
      return await runNew({
        root: flags.root,
        nodeType: positional[1] ?? "",
        title: flags.title ?? "",
        edges: collectEdges(flags),
      });
    case "set":
      return await runSet({
        root: flags.root,
        id: positional[1] ?? "",
        field: positional[2] ?? "",
        value: positional[3] ?? "",
      });
    case "edge":
      return await runEdge({
        root: flags.root,
        op: positional[1] === "rm" ? "rm" : "add",
        from: positional[2] ?? "",
        kind: positional[3] ?? "",
        to: positional[4] ?? "",
      });
    case "status":
      return await runStatus({
        root: flags.root,
        id: positional[1] ?? "",
        status: positional[2] ?? "",
      });
    case "gate":
      // `gate run <id>` | `gate run --all`
      return await runGateCommand({
        root: flags.root,
        id: positional[2] ?? null,
        all: Boolean(flags.all),
      });
    case "version":
      console.log(version);
      return 0;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      return 1;
  }
}

/** Collect declared edge flags (e.g. `--parent x`) into an edge map. */
function collectEdges(flags: Record<string, unknown>): Record<string, string> {
  const edges: Record<string, string> = {};
  for (const kind of EDGE_FLAGS) {
    const value = flags[kind];
    if (typeof value === "string" && value.length > 0) edges[kind] = value;
  }
  return edges;
}
