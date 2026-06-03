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
import { runCheck } from "./commands/check.ts";
import { runIndex } from "./commands/index.ts";

const DEFAULT_ROOT = ".governance";

/** Top-level `--help` text describing the command surface. */
export const HELP = `governor — git-native governance toolkit

Usage:
  governor check [--root <path>] [--json]   Validate a .governance/ tree
  governor index [--root <path>] [--write]  Regenerate the INDEX view
  governor version                          Print the version
  governor --help                           Show this help

Options:
  --root <path>   Path to the .governance/ root (default: ${DEFAULT_ROOT})
  --json          (check) Emit findings as JSON
  --write         (index) Overwrite INDEX.md instead of printing to stdout`;

/**
 * Parse `argv` and run the selected subcommand. Returns the process exit code.
 * Unknown or missing subcommands print help and return a non-zero code.
 */
export async function dispatch(argv: string[], version: string): Promise<number> {
  const flags = parseArgs(argv, {
    boolean: ["json", "write", "help"],
    string: ["root"],
    default: { root: DEFAULT_ROOT },
  });

  const command = flags._[0];

  if (flags.help || command === undefined) {
    console.log(HELP);
    return command === undefined ? 1 : 0;
  }

  switch (command) {
    case "check":
      return await runCheck({ root: flags.root, json: flags.json });
    case "index":
      return await runIndex({ root: flags.root, write: flags.write });
    case "version":
      console.log(version);
      return 0;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      return 1;
  }
}
