/**
 * Review-boundary check (design of record, control 6).
 *
 * Protects reviewability: one staged WorkItem node per commit. The enforceable
 * proxies live here — count staged WorkItems, honor the `Governor-Allow-Multi`
 * override, stamp an evidence-derived `Governor-WorkItem` binding trailer, and
 * raise an advisory scope-vs-churn warning. Honest work decomposition is NOT
 * certifiable in-repo (the actor controls every input) and is delegated to human
 * review — see DESIGN.md control 6.
 *
 * Pure: no git or IO. The CLI gathers the staged set / churn and writes the
 * message file back.
 *
 * @module
 */

import type { ValidationFinding } from "./types.ts";

/** Trailer key for the on-record multi-WorkItem override. */
export const ALLOW_MULTI = "Governor-Allow-Multi";
/** Trailer key for the evidence-derived code↔workstream binding. */
export const WORKITEM_TRAILER = "Governor-WorkItem";

/** Inputs to the review-boundary check (all gathered by the caller). */
export interface ReviewInput {
  /** Distinct staged WorkItem node ids (from `git diff --cached`). */
  stagedWorkItems: string[];
  /** The commit message text. */
  message: string;
  /** Added+deleted line count of the staged diff. */
  churnLines: number;
  /** Churn warning threshold (lines); above it → scope-vs-churn warning. */
  churnThreshold: number;
}

/** Result of the review-boundary check. */
export interface ReviewResult {
  /** `block` rejects the commit; `warn` permits with a notice; `pass` is clean. */
  action: "pass" | "block" | "warn";
  findings: ValidationFinding[];
  /** The single WorkItem id to bind, or `null` when not a clean single-node case. */
  bindingTrailer: string | null;
  /** The message with the binding trailer applied (idempotent). */
  messageWithTrailer: string;
}

/**
 * Evaluate the review boundary. Exactly one staged WorkItem → pass (+ binding
 * trailer). Zero or more-than-one → block, unless a non-empty
 * `Governor-Allow-Multi` trailer overrides. A clean single-node commit whose
 * churn exceeds the threshold → warn (never block).
 */
export function reviewBoundary(inp: ReviewInput): ReviewResult {
  const findings: ValidationFinding[] = [];
  const count = inp.stagedWorkItems.length;
  const override = parseTrailer(inp.message, ALLOW_MULTI);
  const hasOverride = override !== null && override.trim() !== "";

  if (count !== 1 && hasOverride) {
    return result("pass", findings, null, inp.message);
  }

  if (count === 0) {
    findings.push(err(
      "no-workitem",
      "commit stages no WorkItem node; bind the work to a WorkItem, or override with " +
        `\`${ALLOW_MULTI}: <reason>\``,
    ));
    return result("block", findings, null, inp.message);
  }

  if (count > 1) {
    findings.push(err(
      "multi-workitem",
      `commit stages ${count} WorkItem nodes [${inp.stagedWorkItems.join(", ")}]; split them, ` +
        `or override with \`${ALLOW_MULTI}: <reason>\``,
    ));
    return result("block", findings, null, inp.message);
  }

  // Exactly one WorkItem: clean. Bind it, then check scope-vs-churn (advisory).
  const id = inp.stagedWorkItems[0];
  const message = appendTrailer(inp.message, WORKITEM_TRAILER, id);

  if (inp.churnLines > inp.churnThreshold) {
    findings.push(warn(
      "scope-churn",
      `staged diff is ${inp.churnLines} lines for a single WorkItem (threshold ` +
        `${inp.churnThreshold}); confirm this is one reviewable unit`,
    ));
    return result("warn", findings, id, message);
  }

  return result("pass", findings, id, message);
}

/** Read a git trailer's value from `message`, or `null` if absent. */
export function parseTrailer(message: string, key: string): string | null {
  const re = new RegExp(`^${escapeRe(key)}:[ \\t]*(.*)$`, "m");
  const match = message.match(re);
  return match ? match[1].trim() : null;
}

/**
 * Append a `Key: value` trailer to `message`, idempotently — if the exact
 * trailer already exists it is returned unchanged. A blank line separates the
 * trailer block from the body when needed.
 */
export function appendTrailer(message: string, key: string, value: string): string {
  if (parseTrailer(message, key) === value) return message;
  const body = message.replace(/\n+$/, "");
  const sep = body.includes("\n\n") || body.length === 0 ? "\n" : "\n\n";
  return `${body}${sep}${key}: ${value}\n`;
}

function result(
  action: ReviewResult["action"],
  findings: ValidationFinding[],
  bindingTrailer: string | null,
  messageWithTrailer: string,
): ReviewResult {
  return { action, findings, bindingTrailer, messageWithTrailer };
}

function err(code: string, message: string): ValidationFinding {
  return { severity: "error", code, nodeId: "", message };
}

function warn(code: string, message: string): ValidationFinding {
  return { severity: "warn", code, nodeId: "", message };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
