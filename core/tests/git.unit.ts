import { assert, assertEquals } from "@std/assert";
import {
  readGitConfig,
  readGitConfigAll,
  setGitConfig,
  stagedChurn,
  stagedFiles,
} from "../src/git.ts";

async function tempRepo(): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "gov-git-" });
  await new Deno.Command("git", { args: ["init", "-q"], cwd: dir }).output();
  return dir;
}

async function run(cwd: string, args: string[]): Promise<void> {
  await new Deno.Command("git", { args, cwd }).output();
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

Deno.test("stagedFiles lists files in the index, not unstaged ones", async () => {
  const repo = await tempRepo();
  await Deno.writeTextFile(`${repo}/a.txt`, "a");
  await Deno.writeTextFile(`${repo}/b.txt`, "b");
  await run(repo, ["add", "a.txt"]); // only a.txt staged

  const staged = await stagedFiles(repo);

  assertEquals(staged, ["a.txt"]);
});

Deno.test("stagedChurn sums added+deleted lines across staged files", async () => {
  const repo = await tempRepo();
  await Deno.writeTextFile(`${repo}/f.txt`, "l1\nl2\nl3\n");
  await run(repo, ["add", "f.txt"]);

  const churn = await stagedChurn(repo);

  assertEquals(churn, 3); // three added lines
});
