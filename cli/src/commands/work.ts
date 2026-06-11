/**
 * `governor work <id>` — porcelain: a focused orientation view for one node
 * before you start on it. Status, whether it's frozen, the done-state of each
 * blocker, what it blocks (downstream), its produced gate, and a body excerpt.
 *
 * Context-only — no mutation. (The work/plan status enum has no `in_progress`
 * state, and Governor does not invent one.)
 *
 * @module
 */

import {
  blastRadius,
  DEFAULT_TAXONOMY,
  freezeState,
  type GovNode,
  type Graph,
  type Taxonomy,
} from "@dreamrock/governor-core";
import { loadTree } from "../write.ts";

const DONE_STATUSES = new Set(["complete", "closed", "cleared"]);

/** The done-state of a single blocker. */
export interface BlockerState {
  id: string;
  done: boolean;
}

/** The computed orientation view for a node. */
export interface NodeContext {
  id: string;
  title: string;
  status: string;
  frozen: boolean;
  blockedBy: BlockerState[];
  /** Downstream node ids (structural blast radius). */
  downstream: string[];
  /** The produced gate + its status, when the node declares one. */
  gate: { id: string; status: string } | null;
}

function statusOf(node: GovNode | undefined): string {
  const s = node?.frontmatter.status;
  return typeof s === "string" ? s : "";
}

function asList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

/** Compute the orientation view for `id`, or `null` if it does not exist. Pure. */
export function nodeContext(
  graph: Graph,
  id: string,
  taxonomy: Taxonomy = DEFAULT_TAXONOMY,
): NodeContext | null {
  const node = graph.byId.get(id);
  if (!node) return null;

  const blockedBy = asList(node.frontmatter.blocked_by).map((bid) => ({
    id: bid,
    done: DONE_STATUSES.has(statusOf(graph.byId.get(bid))),
  }));

  const gateId = node.frontmatter.produces_gate;
  const gate = typeof gateId === "string"
    ? { id: gateId, status: statusOf(graph.byId.get(gateId)) }
    : null;

  return {
    id: node.id,
    title: typeof node.frontmatter.title === "string" ? node.frontmatter.title : node.id,
    status: statusOf(node),
    frozen: freezeState(graph, id, taxonomy).frozen,
    blockedBy,
    downstream: blastRadius(graph, id, "structural", taxonomy),
    gate,
  };
}

/** Options for the work command. */
export interface WorkOptions {
  root: string;
  id: string;
}

/** Run the work command. Returns the exit code. */
export async function runWork(opts: WorkOptions): Promise<number> {
  const { graph, taxonomy } = await loadTree(opts.root);
  const ctx = nodeContext(graph, opts.id, taxonomy);
  if (!ctx) {
    console.error(`work: no node with id "${opts.id}"`);
    return 1;
  }

  console.log(`${ctx.id} — ${ctx.title} (${ctx.status})${ctx.frozen ? " [frozen]" : ""}`);
  if (ctx.blockedBy.length > 0) {
    console.log("blocked_by:");
    for (const b of ctx.blockedBy) console.log(`  ${b.done ? "[done]" : "[open]"} ${b.id}`);
  }
  if (ctx.downstream.length > 0) console.log(`blocks: ${ctx.downstream.join(", ")}`);
  if (ctx.gate) console.log(`gate: ${ctx.gate.id} (${ctx.gate.status})`);

  const excerpt = graph.byId.get(opts.id)!.body.trim().split("\n").slice(0, 5).join("\n");
  if (excerpt) console.log(`\n${excerpt}`);
  return 0;
}
