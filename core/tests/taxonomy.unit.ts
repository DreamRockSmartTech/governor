import { assert, assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { DEFAULT_TAXONOMY, loadTaxonomy } from "../src/taxonomy.ts";

async function withTempRoot(fn: (root: string) => Promise<void>): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "governor-taxonomy-" });
  try {
    await fn(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

Deno.test("loadTaxonomy returns the defaults when no override file exists", async () => {
  await withTempRoot(async (root) => {
    const taxonomy = await loadTaxonomy(root);
    assertEquals(taxonomy, DEFAULT_TAXONOMY);
  });
});

Deno.test("loadTaxonomy merges a repo override onto the defaults", async () => {
  await withTempRoot(async (root) => {
    await Deno.writeTextFile(
      join(root, "taxonomy.json"),
      JSON.stringify({
        nodeTypes: ["risk"],
        statusByType: { risk: ["open", "mitigated"] },
        edges: {
          mitigates: { reverse: "mitigated_by", structural: true, toDependent: true },
          mitigated_by: { reverse: "mitigates", structural: true, freezes: true },
        },
        idPrefixAliases: { rsk: "risk" },
      }),
    );

    const taxonomy = await loadTaxonomy(root);

    // Extends without losing the shipped defaults.
    assert(taxonomy.nodeTypes.includes("risk"));
    assert(taxonomy.nodeTypes.includes("epic"));
    assertEquals(taxonomy.statusByType.risk, ["open", "mitigated"]);
    assertEquals(taxonomy.idPrefixAliases.rsk, "risk");
    assertEquals(taxonomy.idPrefixAliases.charter, "project");

    // Edge entries are normalized: name from the key, omitted flags default off.
    assertEquals(taxonomy.edges.mitigates, {
      name: "mitigates",
      reverse: "mitigated_by",
      structural: true,
      freezes: false,
      toDependent: true,
    });
    assertEquals(taxonomy.edges.mitigated_by.freezes, true);
    assertEquals(taxonomy.edges.mitigated_by.reverse, "mitigates");
    // Shipped edges untouched.
    assertEquals(taxonomy.edges.parent.freezes, true);
  });
});

Deno.test("loadTaxonomy rejects a malformed override file with a clear error", async () => {
  await withTempRoot(async (root) => {
    await Deno.writeTextFile(join(root, "taxonomy.json"), "{ not json");

    const err = await assertRejects(() => loadTaxonomy(root), Error);
    assert(err.message.includes("taxonomy.json"));
  });
});

Deno.test("loadTaxonomy rejects an override whose shape is not an object", async () => {
  await withTempRoot(async (root) => {
    await Deno.writeTextFile(join(root, "taxonomy.json"), JSON.stringify(["not", "a", "map"]));

    const err = await assertRejects(() => loadTaxonomy(root), Error);
    assert(err.message.includes("taxonomy.json"));
  });
});
