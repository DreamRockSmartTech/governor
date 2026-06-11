import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { installSkill, SKILL_FILES, skillText } from "../mod.ts";

Deno.test("skillText returns the SKILL.md source with its frontmatter intact", async () => {
  const text = await skillText();

  assert(text.startsWith("---\n"), "must begin with a frontmatter block");
  assert(text.includes("name: governor"), "frontmatter must name the skill");
  assert(text.includes("## Phase 1"), "must carry the synchronization protocol");
  assert(text.includes("references/interview.md"), "must point at the interview reference");
});

Deno.test("installSkill writes the full skill directory and reports creation", async () => {
  const dir = await Deno.makeTempDir({ prefix: "governor-skill-" });
  try {
    const dest = join(dir, ".claude", "skills", "governor");
    const result = await installSkill(dest);

    assertEquals(result.action, "created");
    assertEquals(result.files.length, SKILL_FILES.length);
    for (const rel of SKILL_FILES) {
      const written = await Deno.readTextFile(join(dest, rel));
      assert(written.length > 0, `${rel} must be written`);
    }
    assertEquals(await Deno.readTextFile(join(dest, "SKILL.md")), await skillText());
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("installSkill is idempotent and upgrades only the stale file", async () => {
  const dir = await Deno.makeTempDir({ prefix: "governor-skill-" });
  try {
    const dest = join(dir, "skills", "governor");
    await installSkill(dest);

    const unchanged = await installSkill(dest);
    assertEquals(unchanged.action, "unchanged");
    assert(unchanged.files.every((f) => f.action === "unchanged"));

    await Deno.writeTextFile(join(dest, "references", "cli.md"), "stale local edits\n");
    const updated = await installSkill(dest);
    assertEquals(updated.action, "updated");
    const cli = updated.files.find((f) => f.path.endsWith(join("references", "cli.md")))!;
    assertEquals(cli.action, "updated");
    assertEquals(
      updated.files.filter((f) => f.action === "unchanged").length,
      SKILL_FILES.length - 1,
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
