---
uid: f532cc8d-9f20-4532-a466-88878cf23d2d
id: workitem-02-taxonomy-seam-repo-override-derived-freeze-and-blast-radius
node_type: workitem
status: complete
title: "Taxonomy seam: repo override, derived freeze and blast radius"
owner: j.bellero@dreamrocksmarttech.com
parent: masterplan-01-road-to-v1
---

## Description

Finish control 3's portability seam end-to-end: an optional `.governance/taxonomy.json` override
merged onto shipped defaults, `freezes`/`toDependent` flags on `EdgeKind` replacing both hard-coded
kind sets, and the effective taxonomy resolved once per CLI invocation (`loadTree`) for all
commands.

## Evidence

Assessment finding W1/W2: `mergeTaxonomy` existed but nothing loaded an override;
`DEFAULT_TAXONOMY` was hard-coded at 10 CLI call sites; `FREEZING_KINDS` and `STRUCTURAL_FORWARD`
ignored the taxonomy they were handed. H3G's real tree used `guarded_by`/`produces_gate`/
`consumes_gate`/`decisions`/`cited_by`/`gates` — all invisible to symmetry, freeze, and blast
radius, although `produces_gate` is load-bearing for porcelain `done`.

## Approach

`produces_gate`↔`guarded_by` became a structural pair (guarded_by freezes the producer; the gate
stays unfrozen so its human-owned `partial` remains settable); the rest entered as weak one-way
references for dangling detection. A malformed override is a hard error — the file is
authority-bearing, silent fallback would hide misconfiguration. Re-validating H3G with the new
vocabulary surfaced a 13th genuine drift (one-sided gate binding) on top of the 12 known.
