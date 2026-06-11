/**
 * Governor Core — the frontend-agnostic governance library.
 *
 * Portable, git-native governance for any repository: a typed node-graph
 * (charters, plans, epics, gates, decisions, work items) parsed from markdown
 * with YAML frontmatter, with schema and graph-integrity validation. This
 * package is the reusable engine; every frontend (the `@dreamrock/governor-cli`,
 * a future VSCode extension, or any fork) consumes it.
 *
 * Public surface: load a `.governance/` tree, build the in-memory graph,
 * validate it, render the INDEX view (read side); and the write side — create
 * and mutate nodes, run gates, and query/enforce freeze. The serializer and
 * counter file back the write path.
 *
 * @module
 */

export { splitFrontmatter } from "./src/frontmatter.ts";
export { asList, DONE_STATUSES, statusOf } from "./src/fields.ts";
export type { ParsedDocument } from "./src/frontmatter.ts";
export { serializeNode } from "./src/serialize.ts";
export { loadGovernance, nodeFromSource } from "./src/loader.ts";
export { blastRadius, buildGraph } from "./src/graph.ts";
export { validate } from "./src/validate.ts";
export { stagedBoundary } from "./src/staged-check.ts";
export { renderIndex } from "./src/index-view.ts";
export { freezeState, guardMutation, isFrozen } from "./src/freeze.ts";
export type { FreezeState } from "./src/freeze.ts";
export { allocate, loadCounters, writeCounters } from "./src/counters.ts";
export type { Counters } from "./src/counters.ts";
export {
  addEdge,
  createNode,
  MutationError,
  removeEdge,
  setField,
  transitionStatus,
} from "./src/mutate.ts";
export type { CreateResult, NewNodeSpec } from "./src/mutate.ts";
export { runGate } from "./src/gate-runner.ts";
export type { GateResult } from "./src/gate-runner.ts";
export {
  lsStaged,
  lsTree,
  readGitConfig,
  readGitConfigAll,
  setGitConfig,
  showFile,
  stagedChurn,
  stagedFiles,
} from "./src/git.ts";
export {
  ALLOW_MULTI,
  appendTrailer,
  parseTrailer,
  reviewBoundary,
  WORKITEM_TRAILER,
} from "./src/review-boundary.ts";
export type { ReviewInput, ReviewResult } from "./src/review-boundary.ts";
export {
  defaultPolicyHook,
  ENGINE_DIR,
  HOOK_NAMES,
  HOOKS_PATH,
  missingSigningKeys,
  POLICY_DIR,
  SIGNING_MANDATE_KEYS,
  stubScript,
  WRAPPER,
} from "./src/hooks.ts";
export {
  DEFAULT_TAXONOMY,
  isStatusField,
  isStructuralField,
  loadTaxonomy,
  mergeTaxonomy,
  parseTaxonomyOverride,
  resolvePrefix,
  TAXONOMY_FILE,
} from "./src/taxonomy.ts";
export type { EdgeKind, Taxonomy } from "./src/taxonomy.ts";
export type { Edge, GovNode, Graph, Severity, ValidationFinding } from "./src/types.ts";

/** Current package version. Kept in sync with the `version` field in deno.json. */
export const VERSION: string = "0.1.1";
