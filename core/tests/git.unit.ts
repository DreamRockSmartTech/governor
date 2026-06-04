import { assert, assertEquals } from "@std/assert";
import { readGitConfig, readGitConfigAll, setGitConfig } from "../src/git.ts";

async function tempRepo(): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "gov-git-" });
  await new Deno.Command("git", { args: ["init", "-q"], cwd: dir }).output();
  return dir;
}

Deno.test("setGitConfig then readGitConfig round-trips a value", async () => {
  const repo = await tempRepo();

  await setGitConfig(repo, "governor.test", "hello");

  assertEquals(await readGitConfig(repo, "governor.test"), "hello");
});

Deno.test("readGitConfig returns null for an unset key", async () => {
  const repo = await tempRepo();

  assertEquals(await readGitConfig(repo, "governor.missing"), null);
});

Deno.test("readGitConfigAll collects multiple requested keys, omitting unset ones", async () => {
  const repo = await tempRepo();
  await setGitConfig(repo, "user.name", "Justin");
  await setGitConfig(repo, "commit.gpgsign", "true");

  const config = await readGitConfigAll(repo, ["user.name", "commit.gpgsign", "governor.absent"]);

  assertEquals(config["user.name"], "Justin");
  assertEquals(config["commit.gpgsign"], "true");
  // A governor-namespaced key cannot leak in from global/system config.
  assert(!("governor.absent" in config));
});
