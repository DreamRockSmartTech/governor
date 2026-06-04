/**
 * Thin wrappers over the `git` CLI for the config reads/writes the hook
 * installer needs. Governor delegates to `git` (never parses `.git/` directly)
 * so it inherits git's own config resolution (local → global → system).
 *
 * @module
 */

/** Run `git` in `cwd` and return `{ code, stdout }` (stdout trimmed). */
async function git(cwd: string, args: string[]): Promise<{ code: number; stdout: string }> {
  const { code, stdout } = await new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "null",
  }).output();
  return { code, stdout: new TextDecoder().decode(stdout).trim() };
}

/** Read a single git-config value, or `null` if unset. */
export async function readGitConfig(cwd: string, key: string): Promise<string | null> {
  const { code, stdout } = await git(cwd, ["config", "--get", key]);
  return code === 0 ? stdout : null;
}

/** Read several git-config keys at once, omitting any that are unset. */
export async function readGitConfigAll(
  cwd: string,
  keys: readonly string[],
): Promise<Record<string, string>> {
  const config: Record<string, string> = {};
  for (const key of keys) {
    const value = await readGitConfig(cwd, key);
    if (value !== null) config[key] = value;
  }
  return config;
}

/** Set a local (repo-scoped) git-config value. */
export async function setGitConfig(cwd: string, key: string, value: string): Promise<void> {
  const { code } = await git(cwd, ["config", key, value]);
  if (code !== 0) throw new Error(`git config ${key} failed`);
}
