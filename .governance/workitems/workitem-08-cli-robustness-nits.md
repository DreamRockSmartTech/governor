---
uid: 93393992-150f-4364-8764-1a8d0a6084d7
id: workitem-08-cli-robustness-nits
node_type: workitem
status: complete
title: CLI robustness nits
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Three assessment-flagged nits (W5): `governor edge` silently treated any non-`rm` op as `add`
(`edge remove a blocks b` *added* an edge); `writeNode` hand-rolled dirname with a `/` slice; and
`asList`/`statusOf`/`DONE_STATUSES` existed as five private copies across mutate/graph/
staged-check/next/work.

## Evidence

Found in the 2026-06-10 code-quality assessment; the helper duplication had been noted in the
porcelain slice ("promote when a third consumer appears") and the staged-check slice added a fifth
copy.

## Approach

Strict op validation at the parse layer (error before touching any tree); `@std/path` `dirname`;
one exported core `fields.ts` module with the three helpers, swept through all call sites.
