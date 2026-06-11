import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { installSkill, skillText } from "../mod.ts";

Deno.test("skillText returns the SKILL.md source with its frontmatter intact", async () => {
  const text = await skillText();

  assert(text.startsWith("---\n"), "must begin with a frontmatter block");
  assert(text.includes("name: governor"), "frontmatter must name the skill");
  assert(text.includes("## Phase 1"), "must carry the synchronization protocol");
});

Deno.test("installSkill writes SKILL.md into the destination and reports creation", async () => {
  const dir = await Deno.makeTempDir({ prefix: "governor-skill-" });
  try {
    const result = await installSkill(join(dir, ".claude", "skills", "governor"));

    assertEquals(result.action, "created");
    const written = await Deno.readTextFile(result.path);
    assertEquals(written, await skillText());
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("installSkill is idempotent and reports an update when content changed", async () => {
  const dir = await Deno.makeTempDir({ prefix: "governor-skill-" });
  try {
    const dest = join(dir, "skills", "governor");
    await installSkill(dest);

    const unchanged = await installSkill(dest);
    assertEquals(unchanged.action, "unchanged");

    await Deno.writeTextFile(join(dest, "SKILL.md"), "stale local edits\n");
    const updated = await installSkill(dest);
    assertEquals(updated.action, "updated");
    assertEquals(await Deno.readTextFile(updated.path), await skillText());
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
