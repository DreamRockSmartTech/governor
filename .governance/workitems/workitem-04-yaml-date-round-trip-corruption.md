---
uid: c252afa2-3a45-436c-8843-1ba0bab9d8fb
id: workitem-04-yaml-date-round-trip-corruption
node_type: workitem
status: complete
title: YAML date round-trip corruption
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Stop the YAML round-trip from corrupting unquoted dates: parse **and** serialize with the `core`
schema so `created_at: 2026-05-22` stays a plain string, byte-stable with the hand-authored form.

## Evidence

Caught live during the first H3G healing pass: every rewritten node turned `created_at: 2026-05-22`
into `2026-05-22T00:00:00.000Z` (the default schema parses unquoted dates into Date objects, which
re-serialize as ISO timestamps). The healing was reverted, the fix landed red/green, and the
re-healed diff shrank from 81/74 to 48/41 lines — pure edge additions.

## Approach

`splitFrontmatter` and `serializeNode` both use `schema: "core"`; the serializer side also stops
defensively quoting date-like strings. Frontmatter YAML comments are still dropped on rewrite — by
design (CLI-owned frontmatter); commentary belongs in the prose body.
