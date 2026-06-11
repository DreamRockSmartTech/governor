# Governor CLI — complete reference and recipes

Every structural action goes through these commands. The pre-commit hook materializes the staged
snapshot and HEAD from git blobs and rejects any delta the CLI could not have produced — hand edits
to frontmatter are not a shortcut, they are a blocked commit.

## Command reference

```sh
# Orient (read-only)
governor next [--root <path>]            # unblocked open workitems — "what can I do?"
governor work <id>                       # one node: status, blockers, downstream, gate
governor check [--json] [--staged]       # validate the tree; --staged = snapshot + boundary vs HEAD
governor index [--write]                 # regenerate the INDEX view

# Create / mutate (plumbing)
governor new <type> --title <t> [--parent <id>] [--blocks <id>] [--supersedes <id>]
governor set <id> <field> <value>        # plain scalars ONLY (not status, not edges)
governor edge add|rm <from> <kind> <to>  # structural edges, both sides maintained
governor status <id> <new-status>        # work/plan status (gates are machine-owned)

# Prove / finish
governor gate run <id> | --all           # execute criteria_check.runnable; write cleared/failed
governor done <id>                       # run produced gate, complete the node, regen INDEX
governor review-check <msg-file>         # hook-invoked; one-workitem-per-commit boundary
governor init                            # install hooks (requires the git signing mandate)
```

## Node lifecycle recipe

```sh
governor new epic     --title "<mandate>"             --parent masterplan-NN-…
governor new workitem --title "<one reviewable unit>" --parent epic-NN-…
# immediately write the body sections (Description / Evidence / Approach) —
# prose at creation, never bare frontmatter; see structure.md
```

- `new` allocates the `{NN}` counter, generates the uid, stamps `owner` from git config, wires the
  reverse edge onto the parent, regenerates INDEX. Creating a child under a frozen parent is legal
  (new-node wiring); everything else on a frozen node is not.
- `set` writes scalar values as strings. Structural fields are refused (use `edge`); `status` is
  refused (use `status`).
- Weak annotation edges — `decisions`, `cites` — are legal even when the source node is frozen: they
  change no meaning. Structural edges on frozen nodes are blocked → supersede instead.

## Gate recipe — the one sanctioned hand-edit

A gate's `criteria_check` is a structured frontmatter block, and `set` handles only plain scalars —
so the runnable is authored **by hand, in the fresh-node window only**:

```sh
governor new gate --title "<proof of done>"
# NOW, immediately — before wiring any edge to it, in the same session:
# 1. write the proof script (committed governance periphery):
#    .governance/checks/<name>.sh   — executable; exit 0 = cleared, non-zero = failed;
#                                     runs with the REPO ROOT as cwd
# 2. hand-edit the fresh gate's frontmatter to add:
#    criteria_check:
#      runnable: .governance/checks/<name>.sh
#      description: <what this check probes>
#      expectation: <what a pass asserts>
# 3. then wire it:
governor edge add <workitem-id> produces_gate <gate-id>
```

The window closes when the gate gains dependents or the commit lands: after that, a `criteria_check`
change on a gate that anything relies on is blocked at commit (control 4's blocking blast-radius).
Changing a live gate's meaning = supersede the gate.

Gate status is **machine-owned**: only `gate run` / `done` write it (`open` → never proven;
`cleared` → exit 0; `failed` → ran and failed, including regressions). Never `set` it, never edit it
by hand.

## The partial bypass — shipping over a failed gate, on record

`partial: true` is the **human-owned** escape hatch: a deliberate, commit-tracked decision to ship
over an unmet gate. It is orthogonal to status — a gate can be `failed` AND `partial: true`.

```sh
governor set <gate-id> partial true      # only on the user's explicit instruction
```

- The pre-commit hook re-runs every gate and **blocks the commit on any failed gate that does not
  carry `partial: true`**.
- The flip lands in a signed commit: `git blame` on the gate file names who accepted shipping over
  the failure. That audit trail is the point — never set it on your own judgment; surface the
  failing gate to the user and let them decide.

## Commit mechanics

1. Finish the unit: `governor done <workitem-id>` (its gate must clear).
2. Stage the workitem node together with exactly the code it covers.
3. Commit. The hooks enforce: valid staged snapshot, no out-of-band changes vs HEAD, all gates green
   (or `partial`), exactly one staged workitem. The commit-msg hook stamps the evidence-derived
   `Governor-WorkItem: <id>` trailer.
4. A genuinely multi- or zero-workitem commit needs `Governor-Allow-Multi: <reason>` in the message
   — deliberate, rare, on record.
5. `GOVERNOR=0 git commit` bypasses **all** hooks. Last resort only, never silently: tell the user
   first and record the reason as a trailer in the commit message so the bypass itself is signed and
   auditable.

## Known sharp edges

- `set <gate> partial true` stores the string `'true'` (quoted). Enforcement handles both forms;
  just don't be surprised by the quotes when reading the file.
- `gate run` writes the gate file in the working tree. If a status flipped during a pre-commit run,
  the change is unstaged — stage it with the next commit.
- The runnable must be executable (`chmod +x`) and is resolved against the repo root, not
  `.governance/`.
