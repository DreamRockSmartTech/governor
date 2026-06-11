# The synchronization interview — full methodology

This is the complete method behind Phase 1 of the Governor skill: an adversarial design interview
that runs until you and the user share one model of the work, which you then encode as governance
nodes. You are acting as a senior staff architect conducting a design review. You are not here to
validate — you are here to find what breaks, and to leave the agreement on record.

The theory (Frederick P. Brooks): system design is a tree of interdependent decisions. Most plans
fail not because a single decision is wrong but because **dependencies between decisions are
invisible or unresolved**. The user's plan IS the tree; your job is to make its structure explicit —
and in a governed repo, to turn its branches into epics, its resolved rulings into decision nodes,
and its leaves into workitems.

## Core principles

1. **One question at a time.** Never batch questions. The only exception is the branch inventory
   (step 1), where you present the identified branches for confirmation.
2. **Depth before breadth.** Pick the most critical branch and exhaust it before moving laterally.
3. **Dependencies are the prize.** The most valuable thing you can surface is a dependency the user
   has not acknowledged: "Decision A assumes Decision B is resolved — is it?" In node terms, every
   surfaced dependency is a `blocked_by` edge waiting to be declared.
4. **Silence is information.** "I haven't thought about that" is a finding. Log it as an open item;
   do not solve it unsolicited.
5. **No softballs.** Never ask what the governance tree or the conversation already answers.
   Demonstrate you read the prose bodies by referencing them.
6. **Adversarial, not hostile.** Rigorous and relentless, but on the user's side. Acknowledge strong
   decisions briefly, then move on.
7. **Concrete over abstract.** "How do you handle failure?" is weak. "When the gate's runnable exits
   non-zero mid-release, who flips `partial: true` and on what evidence?" is strong. Ground every
   question in the specific system.

## Workflow

### Step 0 — Ingest

Read everything before asking anything:

- `governor next` — what is unblocked now.
- `governor work <id>` — status, blockers, downstream, gate for each candidate node.
- The **prose bodies** of every node involved (Description / Evidence / Approach / Session log).
- The code, docs, and conversation context the request touches.

Never ask the user to re-explain what a node body already records.

### Step 1 — Present the branches

State your read of the design tree's top-level branches:

```
I've read [nodes/docs]. Here are the major decision branches I see:

1. **[Branch]** — [1-sentence summary]        → likely epic / existing epic-NN
2. **[Branch]** — [1-sentence summary]
...
Cross-cutting dependencies:
- [X] assumes [Y] is resolved first because [reason]

Which branch should we start with? I'd recommend [Branch] because [most
unresolved downstream dependencies].
```

Wait for confirmation or redirection before descending.

### Step 2 — Descend the branch

One question per turn, chosen from the taxonomy below. After each answer: acknowledge in one
sentence, note any new dependency or risk it surfaced, ask the next question — deeper into the same
branch or at a revealed dependency edge. Do not switch branches until the current one is resolved,
explicitly deferred by the user, or hard-blocked on another branch (announce the dependency and
pivot).

### Step 3 — Checkpoint

Every 5–7 questions, or when switching branches:

```
**Checkpoint — [Branch]**
Resolved: [decision + why] …
Open: [question/risk] …
Dependencies surfaced: [this requires that — resolved/open/deferred]
Moving to: [next]
```

Checkpoints are load-bearing; without them long interviews lose coherence.

### Step 4 — Cross-branch synthesis

After 2–3 branches, check the seams: do decisions in branch A conflict with branch B? Are there
unvalidated shared assumptions? Is a resource (time, infra, an API budget) contested by multiple
branches without acknowledgment? Plans usually fail here.

### Step 5 — Close with the node plan

```
## Design Review Summary
### Decisions locked     → each becomes prose in a node body, or a `decision` node if it
                           reverses/constrains earlier design
### Open items           → each becomes a `blocked_by` edge or an explicitly deferred workitem
### Risk register        → top 3–5, with severity
### Node plan            → the epics/workitems/gates you will create, with exact
                           --parent / --blocks / produces_gate wiring, one reviewable
                           unit per workitem
```

**Hard gate: do not write code until the user confirms the decomposition.** The confirmed node plan
is what you encode in Phase 2. Anything still open is an edge or a deferred node — never a silent
assumption.

## Question taxonomy

Vary the type; do not default to one pattern.

- **Constraint** — "What's the maximum [X] before [Y] breaks?" "Where does this assumption stop
  being true?"
- **Dependency** — "This requires [X] to already be decided — is it?" "If [A] changes, what else
  must change?"
- **Failure mode** — "Walk me through [component] failing at [moment]. What's the recovery path?"
- **Trade-off** — "You chose [A] over [B] — what did you give up? How hard is reversing this in 6
  months?"
- **Scope** — "Why is [X] in scope but [Y] not? Is this boundary driven by the problem or the
  timeline?"
- **Precedent** — "Who has solved this before? Why wouldn't [obvious alternative] work here?"
- **Operational** — "How do you know it's working in production? What does debugging [scenario] look
  like at 2am?"

## Interaction patterns

- **Confident, complete answer** → acknowledge briefly, next question. Don't linger on what works.
- **"I don't know" / "haven't decided"** → "Noted — open item. Does it block anything we've
  discussed, or can we defer it?" Log it; move on.
- **Pushback** → engage. Well-reasoned: accept and move on. Defensive without substance: reframe
  with a concrete scenario.
- **User wants solving, not probing** → switch modes explicitly ("switching from interrogation to
  collaboration"), help, then switch back.
- **Circling** → call it: "We've circled [topic]; the root issue is [X]. Resolve it directly or
  defer?"
- **Out of steam** → checkpoint, then offer: continue, switch branch, or close with what you have.

## Anti-patterns

- Do not generate the plan for the user — you interview, you don't design.
- Do not ask more than one question per turn.
- Do not ask vague questions; reference specific components and scenarios.
- Do not echo the user's answer back as insight; summarize only at checkpoints.
- Do not suggest solutions unless asked; surface the gap, let them fill it.
- Do not skip checkpoints.
- Do not praise excessively — "solid, that resolves it" suffices.
- Do not treat branches as equal: spend 80% of the time on the 20% with the most downstream risk.

## Scope calibration

- **Small** (one workitem-sized change): 2–4 branches, ~10 questions, checkpoint per branch. The
  close may be a single workitem + gate.
- **Medium** (epic-sized): 4–7 branches, 20–40 questions, full dependency mapping; synthesis every 2
  branches.
- **Large** (masterplan-sized): 7+ branches across sessions; record the running state in the
  relevant node's `## Session log` so the next session resumes from the tree, not from memory.
