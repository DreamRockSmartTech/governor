/**
 * `governor init` — install the git-hook integration (design of record:
 * "Distribution & git-hook integration").
 *
 * Husky-shaped: assert the signing mandate, point git at Governor's hook path,
 * lay down the gitignored engine layer (wrapper + per-hook stubs), and seed the
 * committed, editable policy hooks. Idempotent — safe to re-run; it never
 * clobbers an existing policy hook (the engine layer is always regenerated).
 *
 * @module
 */

import { dirname, join } from "@std/path";
import {
  defaultPolicyHook,
  HOOK_NAMES,
  HOOKS_PATH,
  missingSigningKeys,
  readGitConfigAll,
  setGitConfig,
  SIGNING_MANDATE_KEYS,
  stubScript,
  WRAPPER,
} from "@dreamrock/governor-core";

/** Options for the init command. */
export interface InitOptions {
  /** Path to the `.governance/` root (its parent is the git repo root). */
  root: string;
}

/** Run the init command. Returns the exit code. */
export async function runInit(opts: InitOptions): Promise<number> {
  const repoRoot = dirname(opts.root);

  // 1. Signing mandate — fail hard before touching anything.
  const config = await readGitConfigAll(repoRoot, SIGNING_MANDATE_KEYS);
  const missing = missingSigningKeys(config);
  if (missing.length > 0) {
    console.error("init: git signing mandate not satisfied. Set these git-config keys:");
    for (const key of missing) console.error(`  - ${key}`);
    console.error("Signing is Governor's trust root; refusing to install hooks unsigned.");
    return 1;
  }

  // 2. Point git at Governor's hook path.
  await setGitConfig(repoRoot, "core.hooksPath", HOOKS_PATH);

  // 3. Engine layer (generated, gitignored): wrapper + per-hook stubs.
  const engineDir = join(repoRoot, HOOKS_PATH);
  await Deno.mkdir(engineDir, { recursive: true });
  await writeExecutable(join(engineDir, "governor.sh"), WRAPPER);
  for (const name of HOOK_NAMES) {
    await writeExecutable(join(engineDir, name), stubScript(name));
  }
  // Keep the engine dir out of version control.
  await Deno.writeTextFile(join(engineDir, ".gitignore"), "*\n");

  // 4. Policy layer (committed, editable): seed defaults only when absent.
  const policyDir = dirname(engineDir);
  let seeded = 0;
  for (const name of HOOK_NAMES) {
    const target = join(policyDir, name);
    if (await exists(target)) continue;
    await writeExecutable(target, defaultPolicyHook(name));
    seeded++;
  }

  console.log(`Installed Governor hooks at ${HOOKS_PATH} (core.hooksPath set).`);
  console.log(`Seeded ${seeded} default policy hook(s); ${HOOK_NAMES.length - seeded} left as-is.`);
  return 0;
}

/** Write a file and mark it executable (0o755). */
async function writeExecutable(path: string, content: string): Promise<void> {
  await Deno.writeTextFile(path, content);
  await Deno.chmod(path, 0o755);
}

/** Whether a path exists. */
async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}
