/**
 * Governor Core — the frontend-agnostic governance library.
 *
 * Portable, git-native governance for any repository: a typed node-graph
 * (charters, plans, epics, gates, decisions, work items) parsed from markdown
 * with YAML frontmatter, with schema and graph-integrity validation. This
 * package is the reusable engine; every frontend (the `@dreamrock/governor-cli`,
 * a future VSCode extension, or any fork) consumes it.
 *
 * Public surface (this release): load a `.governance/` tree, build the in-memory
 * graph, validate it, and render the INDEX view. The mutation/creation path
 * (`new`/`set`/`edge`), the gate-proof runner, and freeze enforcement land in
 * later versions.
 *
 * @module
 */

export { splitFrontmatter } from "./src/frontmatter.ts";
export type { ParsedDocument } from "./src/frontmatter.ts";
export { loadGovernance } from "./src/loader.ts";
export { blastRadius, buildGraph } from "./src/graph.ts";
export { validate } from "./src/validate.ts";
export { renderIndex } from "./src/index-view.ts";
export { DEFAULT_TAXONOMY, mergeTaxonomy, resolvePrefix } from "./src/taxonomy.ts";
export type { EdgeKind, Taxonomy } from "./src/taxonomy.ts";
export type { Edge, GovNode, Graph, Severity, ValidationFinding } from "./src/types.ts";

/** Current package version. Kept in sync with the `version` field in deno.json. */
export const VERSION: string = "0.0.1";
