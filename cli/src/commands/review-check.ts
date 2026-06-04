/**
 * `governor review-check <message-file>` — the review-boundary check (control 6),
 * invoked by the `commit-msg` hook.
 *
 * Gathers the staged WorkItem nodes and the diff churn, runs the pure
 * `reviewBoundary` core, then: blocks (exit 1) on a 0/>1-WorkItem commit without
 * an override; warns (exit 0) on scope-vs-churn; on a clean pass writes the
 * evidence-derived `Governor-WorkItem` binding trailer back into the message file.
 *
 * @module
 */

import { basename, dirname } from "@std/path";
import { readGitConfig, reviewBoundary, stagedChurn, stagedFiles } from "@dreamrock/governor-core";

/** Options for the review-check command. */
export interface ReviewCheckOptions {
  /** Path to the commit-message file git passes to `commit-msg` ($1). */
  messageFile: string;
  /** Path to the `.governance/` root (its parent is the git repo root). */
  root: string;
}

const DEFAULT_CHURN_THRESHOLD = 400;

/** Extract WorkItem node ids from staged paths (e.g. `…/workitem-12-x.md`). */
export function stagedWorkItemIds(paths: string[]): string[] {
  const ids = new Set<string>();
  for (const path of paths) {
    const name = basename(path);
    const match = name.match(/^(workitem-\d+-[a-z0-9-]+)\.md$/);
    if (match) ids.add(match[1]);
  }
  return [...ids];
}

/** Run the review-check command. Returns the exit code (1 blocks the commit). */
export async function runReviewCheck(opts: ReviewCheckOptions): Promise<number> {
  const repoRoot = dirname(opts.root);
  const message = await Deno.readTextFile(opts.messageFile);
  const workItems = stagedWorkItemIds(await stagedFiles(repoRoot));
  const churnLines = await stagedChurn(repoRoot);
  const churnThreshold = await readChurnThreshold(repoRoot);

  const result = reviewBoundary({
    stagedWorkItems: workItems,
    message,
    churnLines,
    churnThreshold,
  });

  for (const f of result.findings) {
    const tag = f.severity === "error" ? "ERROR" : "warn ";
    console.error(`review-check ${tag} ${f.code}: ${f.message}`);
  }

  if (result.action === "block") return 1;

  // pass | warn: persist the binding trailer if the check added one.
  if (result.messageWithTrailer !== message) {
    await Deno.writeTextFile(opts.messageFile, result.messageWithTrailer);
  }
  return 0;
}

/** Read the churn warning threshold from git config, defaulting if unset. */
async function readChurnThreshold(repoRoot: string): Promise<number> {
  const raw = await readGitConfig(repoRoot, "governor.churnThreshold");
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHURN_THRESHOLD;
}
