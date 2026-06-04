# ADR-0001 — Approval authority: exclude `approved_by`, keep `owner` auto-stamp

- **Status:** Accepted
- **Date:** 2026-06-04
- **Supersedes wording in:** [DESIGN.md → Authority & the approval record](../DESIGN.md)

## Context

DESIGN.md originally said `approved_by` is "derived/stamped from the **verified commit signer**" and
treated it as applying to all node types, while also declaring ACL "out of scope (repo access _is_
authority)." Implementing that for real surfaced three problems:

1. **What is approved?** `approved_by` re-stamped on every edit is a redundant echo of the commit
   signer (git history already records that). The only node type that needs a genuine human sign-off
   / review process is the **`decision`** — everything else (epics, work items, gates) is work,
   owned by whoever commits it, or machine-authorized (gates, by their proof).
2. **Local git cannot atomically verify-and-record approval.** A commit's signature is the last step
   of making it, so nothing _inside_ a commit can depend on verifying that commit's own signature
   (chicken-and-egg). `post-merge` stamping would require a `merge+1` commit; `pre-merge-commit` can
   stamp but only from **git-config identity** (no signature exists yet), and it does **not** run on
   fast-forward or conflicted merges.
3. **The cloud path is incompatible.** On GitHub/GitLab the approver acts in the **platform** (API:
   `pulls/{n}/reviews`, MR `approvals`), _after_ the commits exist; the merge is performed by the
   platform/merger identity, not the approver's signing key. Writing the approver into the file
   requires a CI bot to amend or add a cleanup commit (the `merge+1` problem again), signed by the
   **bot**, not the approver — so the in-file stamp's provenance is wrong and unverifiable from git.

There is **no unified mechanism** that records a _verified approver_ into the node file at merge
time across both bare-repo and cloud-host worlds without monkey-patching. The cloud platforms
already enforce approval properly (required reviewers, branch protection, signed audit trail);
re-deriving it into a file is strictly worse and redundant — "reinvent the forge, badly."

## Decision

1. **Exclude `approved_by` / `reviewers` from Governor's scope.** Governor does not stamp, derive,
   or enforce approver identity. Approval authority is **owned by the host's review system** (cloud
   PR/MR required-reviewers + branch protection; or, for a bare repo, the team's own process). This
   is a documented **stage-3 seam**, not a built feature.
2. **Keep `owner`, auto-stamped from the committer.** Every node carries `owner` = the committing
   user's git-config identity (`user.email`), set by Governor at creation. It is **stewardship /
   responsibility**, not approval. No signature verification — it is a convenience record; git
   history remains the authority.
3. **Gates** are authorized by their proof (the gate-proof runner), never by `approved_by`.

This **reverses** two DESIGN.md lines: "derive `approved_by` from the verified signer," and the
implication that `approved_by` is a Governor-managed field on all nodes.

## Consequences

- The hooks slice ships with **no `approved_by` machinery**; the `commit-msg` default stays a
  placeholder only for the **review-boundary check** (control 6), not approval stamping.
- Governor stays cleanly git-native and stops exactly where git can't help (enforcing
  who-may-merge), handing that to the host — the correct division of labor.
- An existing `approved_by` value in a consuming tree (e.g. H3G's) is **tolerated** (free-form
  frontmatter), just not written or validated by Governor.
- **Deferred:** bootstrapping Governor's own `.governance/` self-governance tree (this ADR would
  otherwise have been a `decision` node within it — recorded as an ADR for now to avoid a
  side-quest).
