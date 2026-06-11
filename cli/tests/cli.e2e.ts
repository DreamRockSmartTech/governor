/**
 * CLI integration suite — drives the command runners against real temp git
 * repositories, automating what previous slices verified by hand on scratch
 * repos: init's mandate + idempotency, the new→set→done lifecycle, the gate
 * runner, the staged boundary, the review boundary, and the installed hooks
 * end-to-end (via actual `git commit`).
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { runInit } from "../src/commands/init.ts";
import { runNew } from "../src/commands/new.ts";
import { runSet } from "../src/commands/set.ts";
import { runDone } from "../src/commands/done.ts";
import { runStatus } from "../src/commands/status.ts";
import { runGateCommand } from "../src/commands/gate.ts";
import { runCheck } from "../src/commands/check.ts";
import { runReviewCheck } from "../src/commands/review-check.ts";

/** Absolute path of this checkout's CLI entry, for hook scripts. */
const CLI_MOD = fromFileUrl(import.meta.resolve("../mod.ts"));

interface Fixture {
  repo: string;
  root: string;
}

/** A temp git repo with a `.governance/` root and the signing mandate set. */
async function fixture(opts: { mandate?: boolean } = {}): Promise<Fixture> {
  const repo = await Deno.makeTempDir({ prefix: "governor-e2e-" });
  await git(repo, ["init", "-q"]);
  await git(repo, ["config", "user.name", "Test User"]);
  await git(repo, ["config", "user.email", "test@example.com"]);
  if (opts.mandate !== false) {
    await git(repo, ["config", "commit.gpgsign", "true"]);
    await git(repo, ["config", "gpg.program", "/usr/bin/gpg"]);
    await git(repo, ["config", "user.signingkey", "TESTKEY"]);
  }
  const root = join(repo, ".governance");
  await Deno.mkdir(root);
  return { repo, root };
}

async function git(cwd: string, args: string[]): Promise<{ code: number; out: string }> {
  const { code, stdout, stderr } = await new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const dec = new TextDecoder();
  return { code, out: dec.decode(stdout) + dec.decode(stderr) };
}

/** Commit without invoking the (unavailable) signing key. */
async function commit(repo: string, msg: string): Promise<{ code: number; out: string }> {
  await git(repo, ["add", "-A"]);
  return await git(repo, ["-c", "commit.gpgsign=false", "commit", "-m", msg]);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

Deno.test("init fails hard without the signing mandate and installs nothing", async () => {
  const { repo, root } = await fixture({ mandate: false });

  assertEquals(await runInit({ root }), 1);
  assertEquals(await exists(join(root, "hooks")), false);
  assertEquals((await git(repo, ["config", "--get", "core.hooksPath"])).code, 1);
});

Deno.test("init installs the two-tier layout, is idempotent, never clobbers policy", async () => {
  const { repo, root } = await fixture();

  assertEquals(await runInit({ root }), 0);
  assertEquals(
    (await git(repo, ["config", "--get", "core.hooksPath"])).out.trim(),
    ".governance/hooks/_",
  );
  assert(await exists(join(root, "hooks/_/governor.sh")));
  assert(await exists(join(root, "hooks/pre-commit")));
  assertStringIncludes(
    await Deno.readTextFile(join(root, "hooks/pre-commit")),
    "governor check --staged",
  );

  // Edit the policy hook, re-run init: engine regenerated, policy preserved.
  await Deno.writeTextFile(join(root, "hooks/pre-commit"), "#!/bin/sh\n# customized\nexit 0\n");
  assertEquals(await runInit({ root }), 0);
  assertStringIncludes(await Deno.readTextFile(join(root, "hooks/pre-commit")), "customized");
});

Deno.test("new -> set -> done lifecycle: counters, freeze, INDEX", async () => {
  const { root } = await fixture();

  await runNew({ root, nodeType: "epic", title: "Mandate", edges: {} });
  await runNew({
    root,
    nodeType: "workitem",
    title: "Task One",
    edges: { parent: "epic-01-mandate" },
  });

  // High-water counter persisted.
  const counters = JSON.parse(await Deno.readTextFile(join(root, "counters.json")));
  assertEquals(counters, { epic: 1, workitem: 1 });

  // Dependent stays editable; the depended-upon epic is meaning-locked.
  assertEquals(
    await runSet({ root, id: "workitem-01-task-one", field: "priority", value: "high" }),
    0,
  );
  assertEquals(await runSet({ root, id: "epic-01-mandate", field: "title", value: "Renamed" }), 1);

  // done completes the workitem (no gate) and the epic completes via status.
  assertEquals(await runDone({ root, id: "workitem-01-task-one" }), 0);
  assertEquals(await runStatus({ root, id: "epic-01-mandate", status: "complete" }), 0);

  const workitem = await Deno.readTextFile(join(root, "workitems/workitem-01-task-one.md"));
  assertStringIncludes(workitem, "status: complete");
  assertStringIncludes(await Deno.readTextFile(join(root, "INDEX.md")), "node_type: index");
});

Deno.test("gate run writes machine-owned status from the runnable's exit code", async () => {
  const { repo, root } = await fixture();
  await runNew({ root, nodeType: "gate", title: "Proof", edges: {} });

  // Author the structured criteria_check on the fresh gate (the supported
  // hand-authoring window: no dependents rely on it yet).
  const gatePath = join(root, "gates/gate-01-proof.md");
  const gateSource = await Deno.readTextFile(gatePath);
  await Deno.writeTextFile(
    gatePath,
    gateSource.replace("status: open", "status: open\ncriteria_check:\n  runnable: check.sh"),
  );
  await Deno.writeTextFile(join(repo, "check.sh"), "#!/bin/sh\nexit 0\n");
  await Deno.chmod(join(repo, "check.sh"), 0o755);

  assertEquals(await runGateCommand({ root, id: "gate-01-proof", all: false }), 0);
  assertStringIncludes(await Deno.readTextFile(gatePath), "status: cleared");

  // Bidirectional: a regressed check flips the gate back to failed.
  await Deno.writeTextFile(join(repo, "check.sh"), "#!/bin/sh\nexit 1\n");
  assertEquals(await runGateCommand({ root, id: "gate-01-proof", all: false }), 1);
  assertStringIncludes(await Deno.readTextFile(gatePath), "status: failed");
});

Deno.test("done refuses to complete a node whose produced gate fails", async () => {
  const { repo, root } = await fixture();
  await runNew({ root, nodeType: "workitem", title: "Gated Task", edges: {} });
  await runNew({ root, nodeType: "gate", title: "Failing Proof", edges: {} });

  const wiPath = join(root, "workitems/workitem-01-gated-task.md");
  await Deno.writeTextFile(
    wiPath,
    (await Deno.readTextFile(wiPath)).replace(
      "status: open",
      "status: open\nproduces_gate: gate-01-failing-proof",
    ),
  );
  const gatePath = join(root, "gates/gate-01-failing-proof.md");
  await Deno.writeTextFile(
    gatePath,
    (await Deno.readTextFile(gatePath)).replace(
      "status: open",
      "status: open\ncriteria_check:\n  runnable: nope.sh\nguarded_by: workitem-01-gated-task",
    ),
  );
  await Deno.writeTextFile(join(repo, "nope.sh"), "#!/bin/sh\nexit 1\n");
  await Deno.chmod(join(repo, "nope.sh"), 0o755);

  assertEquals(await runDone({ root, id: "workitem-01-gated-task" }), 1);
  assertStringIncludes(
    await Deno.readTextFile(wiPath),
    "status: open", // stays open — the gate is the evidence
  );
});

Deno.test("check --staged blocks a frozen-node hand edit; the CLI path passes", async () => {
  const { repo, root } = await fixture();
  await runNew({ root, nodeType: "epic", title: "Mandate", edges: {} });
  await runNew({
    root,
    nodeType: "workitem",
    title: "Task",
    edges: { parent: "epic-01-mandate" },
  });
  await commit(repo, "init tree");

  // Hand edit the frozen epic's body, stage it: blocked.
  const epicPath = join(root, "epics/epic-01-mandate.md");
  await Deno.writeTextFile(epicPath, (await Deno.readTextFile(epicPath)) + "\nSneaky rewrite.\n");
  await git(repo, ["add", "-A"]);
  assertEquals(await runCheck({ root, json: false, staged: true }), 1);

  // The CLI's own writes (set on the dependent) pass the same boundary.
  await git(repo, ["reset", "--hard", "HEAD", "-q"]);
  await runSet({ root, id: "workitem-01-task", field: "priority", value: "high" });
  await git(repo, ["add", "-A"]);
  assertEquals(await runCheck({ root, json: false, staged: true }), 0);
});

Deno.test("review-check binds a single staged workitem and blocks a no-workitem commit", async () => {
  const { repo, root } = await fixture();
  await runNew({ root, nodeType: "workitem", title: "Bound Task", edges: {} });
  await commit(repo, "init tree");

  // No governance change staged, code-only commit: blocked without override.
  await Deno.writeTextFile(join(repo, "code.ts"), "export const x = 1;\n");
  await git(repo, ["add", "code.ts"]);
  const msgFile = join(repo, ".git/TEST_MSG");
  await Deno.writeTextFile(msgFile, "feat: code only\n");
  assertEquals(await runReviewCheck({ root, messageFile: msgFile }), 1);

  // The on-record override permits it.
  await Deno.writeTextFile(msgFile, "feat: code only\n\nGovernor-Allow-Multi: fixture\n");
  assertEquals(await runReviewCheck({ root, messageFile: msgFile }), 0);

  // One staged workitem: passes and stamps the binding trailer.
  await runSet({ root, id: "workitem-01-bound-task", field: "priority", value: "low" });
  await git(repo, ["add", "-A"]);
  await Deno.writeTextFile(msgFile, "feat: bound work\n");
  assertEquals(await runReviewCheck({ root, messageFile: msgFile }), 0);
  assertStringIncludes(
    await Deno.readTextFile(msgFile),
    "Governor-WorkItem: workitem-01-bound-task",
  );
});

Deno.test("installed hooks enforce at git commit time; GOVERNOR=0 bypasses", async () => {
  const { repo, root } = await fixture();
  await runNew({ root, nodeType: "workitem", title: "Hooked Task", edges: {} });
  assertEquals(await runInit({ root }), 0);

  // Point the policy hooks at this checkout (no installed `governor` binary).
  await Deno.writeTextFile(
    join(root, "hooks/pre-commit"),
    `#!/bin/sh\ndeno run -A ${CLI_MOD} check --staged\n`,
  );
  await Deno.writeTextFile(
    join(root, "hooks/commit-msg"),
    `#!/bin/sh\ndeno run -A ${CLI_MOD} review-check "$1"\n`,
  );

  // Clean single-workitem commit: passes both hooks, trailer stamped by git.
  const first = await commit(repo, "[ADD]: hooked task");
  assertEquals(first.code, 0, first.out);
  assertStringIncludes(
    (await git(repo, ["log", "-1", "--format=%B"])).out,
    "Governor-WorkItem: workitem-01-hooked-task",
  );

  // A code-only commit is blocked by commit-msg…
  await Deno.writeTextFile(join(repo, "code.ts"), "export const x = 1;\n");
  const blocked = await commit(repo, "feat: code with no workitem");
  assertEquals(blocked.code, 1);

  // …and GOVERNOR=0 consciously bypasses.
  await git(repo, ["add", "-A"]);
  const bypass = await new Deno.Command("git", {
    args: ["-c", "commit.gpgsign=false", "commit", "-m", "bypass: emergency"],
    cwd: repo,
    env: { GOVERNOR: "0" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(bypass.code, 0);
});
