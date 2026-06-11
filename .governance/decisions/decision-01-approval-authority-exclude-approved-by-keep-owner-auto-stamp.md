---
uid: 9fc18fbf-09a4-4e6d-a475-29cd481c1a3f
id: decision-01-approval-authority-exclude-approved-by-keep-owner-auto-stamp
node_type: decision
status: accepted
title: 'Approval authority: exclude approved_by, keep owner auto-stamp'
owner: j.bellero@dreamrocksmarttech.com
---

## Context

DESIGN.md originally intended `approved_by` to be derived and stamped from the verified commit
signer. Implementing this surfaced three blockers: (1) an `approved_by` re-stamped on every edit is
a redundant echo of the commit signer — git history already records that; (2) local git cannot
atomically verify-and-record approval, since a commit's signature is the last step of making it and
nothing inside a commit can depend on verifying that same commit's signature; (3) on cloud hosts
(GitHub, GitLab) the approver acts in the platform API after the commits exist, and writing the
approver into the file requires a CI bot commit signed by the bot — not the approver — making the
in-file stamp's provenance wrong and unverifiable.

There is no unified mechanism that records a verified approver into the node file at merge time
across both bare-repo and cloud-host worlds without monkey-patching. Cloud platforms already enforce
approval properly (required reviewers, branch protection); re-deriving it into a file is redundant.

## Decision

`approved_by` / `reviewers` are excluded from Governor's scope. Governor does not stamp, derive, or
enforce approver identity. Approval authority is owned by the host's review system. Governor keeps
`owner`, auto-stamped from the committer's git `user.email` at node creation — this is stewardship
(who is responsible), not approval. Gates are authorized by their proof (the gate-proof runner),
never by an `approved_by` field.

## Consequences

The hooks slice shipped with no `approved_by` machinery. An existing `approved_by` value in a
consuming tree is tolerated (free-form frontmatter), not written or validated by Governor. The
`commit-msg` hook enforces only the review-boundary check (one WorkItem/commit), not approval
stamping. Stage-3 approval (cloud PR merge) remains a documented seam — the right division of labor
between Governor and the host.

Full rationale: [docs/decisions/ADR-0001-approval-authority-scope.md](../../docs/decisions/ADR-0001-approval-authority-scope.md)
