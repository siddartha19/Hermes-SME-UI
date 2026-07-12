---
status: APPROVED
version: 1
mode: BUILDER (hackathon, 8h)
owner: "@siddartha19"
generated_by: /office-hours on 2026-07-11
relates_to: docs/plans/company-brain.md
locked_decisions:
  connection: "A — filesystem is the interface (brain/ shared by Hermes + cockpit)"
  ship_target: "tiny purpose-built demo app + fast tests, Sentry-instrumented"
  ship_gate: "auto-decide; PR is the human gate"
---
# Alera on Hermes — the company brain that decides what to build and ships it

Generated from a /office-hours builder session on 2026-07-11.

**One line:** Alera is a Hermes-native skill pack + a read-only web cockpit. The brain
is a folder of Markdown. Hermes is the runtime. The cockpit is how you watch it and
trust it. It closes the full loop: **customer signals → mission check → spec → code →
test → PR**, plus a proactive arm that **ideates → validates → ships**.

> Reuses the "brain = linked, self-updating memory" idea from `docs/plans/company-brain.md`,
> but is a standalone hackathon artifact built ON Hermes (not on the Alera backend). No
> Postgres, no FastAPI, no React Flow graph. The brain is files; Hermes does the work.

---

## What makes this cool (the "whoa")

The demo moment is not the PR. It is the **rejection**. The agent approves one cluster
("4 customers across 3 channels want CSV export — aligned with mission §2, building it")
and rejects another ("2 users want crypto payments — off-mission, logged and declined,
here's the mission line it failed"). An agent that says *no* with a cited reason is what
makes the *yes* believable. You watch a card slide Signals → Judging → Building →
Verifying → Shipped on a live board while a second card drops into Rejected.

---

## Positioning (why this is not the other things)

| | Focus |
|---|---|
| Superpowers / gstack | *how* to build well (TDD discipline, role review) |
| paperclip.ing | *who* does the work (org chart, budgets, heartbeats) |
| supermemory / gbrain | *remembers* — store & recall (passive) |
| **Alera** | **decides *what* to build and *whether* to — mission-governed judgment → PR, with a cockpit to watch the loop** |

Memory is table stakes. The judgment and the action are the product. The cockpit makes
the judgment visible and trustable.

---

## Scope decisions (locked in brainstorm)

| Decision | Choice | Why |
|---|---|---|
| Shape | **Hermes skill pack + read-only cockpit** — not a standalone product | Hermes already provides scheduler, memory, messaging, delegation. Building a paperclip-style control plane in 8h is infeasible and redundant. |
| Brain | **A folder of Markdown** (`brain/`) | Portable, inspectable, no DB. The brain IS the contract between Hermes and the cockpit. |
| Loops | **Reactive** (signals→ship) is the must-ship core; **Proactive** (ideate→validate→ship) is the second act | Never risk having neither loop working. |
| Connectors | **GitHub (live), Slack + Sentry (live-or-fixture)** | These three instrument the whole loop with no wasted pick (see below). Open scope for more. |
| Cockpit | **Read-only** — reflects Hermes state, does not drive it | Read-only cockpit is an 8h win; a control plane is not. |
| Ship gate | **Auto-decide, PR is the human gate** (LOCKED) | Agent commits nothing irreversible; a human merges. |
| Connection | **A — filesystem is the interface** (LOCKED) | Brain folder shared by Hermes + cockpit; no API/DB. |
| Ship target | **Tiny purpose-built demo app**, Sentry-instrumented, fast tests (LOCKED) | Reliable staged error→fix→PR for the demo. |

**Bright line (do not cross):** the cockpit only *reflects* the brain. The moment the UI
starts *driving* Hermes or managing live OAuth, it becomes paperclip and eats the 8 hours.

---

## The connector trio is not arbitrary

- **Slack** → team/customer chatter = signals *in* (top of loop)
- **Sentry** → error events = signals *in*, the highest-confidence kind an agent can act on
- **GitHub** → issues *in* (more signals) **and** PRs *out* (the ship)

Slack + Sentry feed the top; GitHub is both a source and the finish line. A Sentry error
and a Slack complaint converge → judge → PR on GitHub.

---

## Architecture

```
                          ┌──────────────────────────────────────┐
   Slack ─┐               │              brain/  (Markdown)        │
 Sentry ─┼─ ingest ─────▶ │  mission.md  strategy.md  product.md   │
 GitHub ─┘   (skill)      │  decisions.md   signals/  clusters/    │
                          │  verdicts/  hypotheses/  experiments/  │
                          │  logs/activity.jsonl                   │
                          └───────────────┬────────────────────────┘
                                          │  reads + writes files
                          ┌───────────────▼────────────────────────┐
                          │        Hermes runtime (the engine)      │
                          │  cron ▸ skills ▸ memory ▸ gh CLI ▸ tools │
                          │  ingest→cluster→judge→spec→build→verify→ │
                          │  ship→report   (+ ideate→validate arm)   │
                          └───────────────┬────────────────────────┘
                                          │  reads same files (watch/poll)
                          ┌───────────────▼────────────────────────┐
                          │      Alera cockpit  (read-only web)     │
                          │  Board · Skills · Connectors · Evidence │
                          │  Mission bar · Activity feed · Rejected  │
                          └─────────────────────────────────────────┘
```

Two entry points, one ship pipeline:

```
REACTIVE:   signals ─▶ cluster ─▶ judge ─┐
                                          ├─▶ spec ─▶ build ─▶ verify ─▶ ship ─▶ report
PROACTIVE:  ideate ─▶ validate ─▶ judge ─┘
```

Both arms pass the **same mission `judge` gate** before anything ships.

---

## How Alera connects to Hermes (the one real fork)

### Approach A — Filesystem is the interface (RECOMMENDED for 8h)
Hermes and the cockpit share the `brain/` folder. Hermes reads/writes Markdown; the
cockpit is a thin web app that watches the same files and renders them. Any UI "action"
(rare, since it's read-only) is just writing a file Hermes' cron picks up.
- **Pros:** no API to build, works with Hermes as-is, the brain is the contract,
  portable, inspectable. UI and agent restart independently. Ships in an hour.
- **Cons:** eventual consistency (file-watch/poll, ~1s). No push. Fine for a demo.
- **How Hermes "uses the Alera brain to decide":** literally — its skills read
  `mission.md` / `strategy.md` and write verdicts. No indirection.

### Approach B — Alera as an MCP server (the productization story)
Alera exposes an MCP server with tools like `whats_next()`, `get_pending_signals()`,
`record_verdict()`. Hermes (MCP client) calls them during its loop; the cockpit reads
the same store.
- **Pros:** clean tool contract, real-time, MCP is Hermes-native, makes "Hermes queries
  the brain" a literal API call. Extensible.
- **Cons:** MCP server + a datastore + wiring = more than 8h alongside two loops.
- **Verdict:** mention in the pitch as the v2 path. A tiny read-only MCP shim over the
  same `brain/` files is a stretch goal if the core lands early.

### Approach C — HTTP/RPC bridge + job runner
A backend both the UI and Hermes talk to; it spawns `hermes` runs and streams output
over websockets.
- **Pros:** real-time feed, UI can trigger runs.
- **Cons:** most infra, drifts toward paperclip, highest 8h risk.
- **Verdict:** do not build for the hackathon.

**Recommendation: A now, name B as the roadmap.** "The brain is a folder; Hermes and the
cockpit both speak Markdown" is the clean, honest, buildable story.

---

## The brain — folder spec

```
brain/
  mission.md          # vision, principles — the governance filter. Rarely changes.
  strategy.md         # this quarter's bet, now/next/later. Changes monthly.
  product.md          # what exists today + architecture notes — grounds codegen.
  decisions.md        # append-only log: what shipped/rejected, why, evidence. The memory.
  signals/            # inbox — one file per signal (from Slack/Sentry/GitHub or fixtures).
  clusters/           # written BY agent: 3+ converging signals grouped.
  verdicts/           # written BY agent: approved/rejected + the mission line cited.
  hypotheses/         # written BY ideate (proactive arm): ranked, testable bets.
  experiments/        # written BY validate: proof-test design + result + evidence.
  logs/activity.jsonl # append-only run log the cockpit tails for the live feed.
```

Top files are the constitution (read). Bottom folders are the output (written). The
growing `decisions.md` is the visible proof it's a brain, not a script.

---

## The skills (Hermes SKILL.md files, one per stage)

Each stage is a skill; the brain files are the state passed between them. Decomposing
(vs one mega-prompt) is what lets Hermes improve each skill across runs — its headline
learning-loop feature.

| Skill | Reads | Writes | Does |
|---|---|---|---|
| `ingest` | `signals/` (+ connectors) | normalized `signals/` | pull, normalize, dedupe |
| `cluster` | `signals/` | `clusters/` | group 3+ signals from different sources |
| `judge` | `clusters/`, `mission.md`, `strategy.md` | `verdicts/` | approve/reject each cluster, **cite the exact mission line** |
| `ideate` | whole brain | `hypotheses/` | proactive: propose what to build next from gaps + weak clusters |
| `validate` | `hypotheses/`, `signals/`, `decisions.md` | `experiments/` | evidence-backtest (default) + optional concierge test |
| `spec` | approved `verdicts/`/`experiments/`, `product.md` | a spec | write the implementation spec |
| `build` | spec, target repo | code in target repo | implement (file + code + terminal tools) |
| `verify` | target repo | test results | run tests; loop back to `build` (max N) if red |
| `ship` | target repo | PR + `decisions.md` entry | `gh pr create`; append the decision |
| `report` | `decisions.md` | Telegram/Slack msg | send the evidence-chain summary |

Hermes-native flourishes: `cron` triggers `ingest`; **persistent memory** gives post-ship
matching for free (a new signal about a shipped feature → "already handled in decision #7").

---

## The cockpit — cockpit spec (read-only)

Pages (all just render `brain/` + `gh auth status`):

- **Board** (hero) — Kanban: Signals → Judging → Building → Verifying → Shipped, plus a
  **Rejected** lane. Cards show source icon (Slack/Sentry/GitHub), an **origin tag**
  (`reactive` / `proactive`), and title. Cards move as files move between folders.
- **Skills** — render each `SKILL.md`: name, purpose, run-count.
- **Connectors** — GitHub / Slack / Sentry tiles with connected state; more tiles with a
  "Connect" button (open scope). GitHub is genuinely connected via `gh`.
- **Evidence chain** (card detail) — click a shipped card → signals that fed it → the
  mission line it passed → the spec → the PR link. The whole thesis on one screen.
- Always-visible **Mission bar** (top) + **metrics strip** (signals / clusters / shipped
  / rejected / spend) + a live **"now working on"** activity feed tailing `activity.jsonl`.

Tech: keep it trivial. A single Vite + React (or even static HTML) app that reads the
`brain/` files (via a tiny static file server or a ~20-line Node endpoint) and re-renders
on a 1s poll or a file-watch SSE. No backend framework, no DB.

---

## The 8 hours

Prep BEFORE the clock if rules allow: Hermes installed, `gh` authenticated, target repo
with a fast test suite, `brain/` seeded (mission, strategy, product, ~12 signals = one
clean on-mission cluster + one off-mission cluster + noise).

| Hours | Work | Verify |
|---|---|---|
| 0–1 | Hermes setup, brain seeded, cockpit renders the board from files | a seeded signal shows as a card |
| 1–3 | `cluster` + `judge` skills | correct approve/reject verdicts with citations on the 12 signals |
| 3–5 | `spec`→`build`→`verify`→`ship` on the staged feature | a real PR with green tests, opened unattended |
| 5–6 | `report` + evidence-chain view + end-to-end run | full loop, card moves live on the board |
| 6–7 | proactive arm (`ideate`→`validate`) as second act; stage clean demo; **record backup video** | proactive card ships or recommends |
| 7–8 | pitch: problem → live demo → the rejection moment → PR diff | — |

**Priority spine (protect in order):** Sentry/Slack signal → `judge` → GitHub PR, shown
moving on the board. Everything else is polish. If `build` flails at hour 4, downgrade the
staged change to a copy/config fix — the loop matters more than the feature's size.

---

## Demo script (90 seconds)

1. Board on screen. Mission bar visible.
2. A Sentry error + a Slack complaint about the same thing appear in **Signals**.
3. `cluster` groups them; card enters **Judging**; verdict cites `mission.md` and it moves
   to **Building**.
4. Watch it go **Building → Verifying → Shipped** with a live PR link.
5. Meanwhile a "crypto payments" card lands in **Rejected** with the failed mission line.
6. Click the shipped card → the evidence chain (signals → mission → spec → PR).

---

## Risks & mitigations

1. **`build` leg flakes live.** Mitigation: stage a feature you've verified an agent can
   do; downgrade to a small change if needed; have the recorded backup video.
2. **Slack/Sentry live wiring fails on venue Wi-Fi.** Mitigation: fixtures in `signals/`
   are the default path; live pull is a bonus, never a single point of failure.
3. **Scope creep into a control plane.** Mitigation: cockpit stays read-only; connectors
   page is mostly visual; no UI-driven Hermes triggers.
4. **Two loops in 8h.** Mitigation: reactive is the must-ship; proactive is the second act
   and can validate-and-recommend without auto-shipping.

---

## Acceptance tests (executable)

**Brain + cockpit**
- [ ] Dropping a file in `brain/signals/` makes a card appear in the Board's Signals lane
      within ~1s (poll/watch works).
- [ ] The Mission bar renders the first heading of `mission.md`.
- [ ] The activity feed tails a new line appended to `brain/logs/activity.jsonl`.

**Reactive loop**
- [ ] Seeding 4 signals about the same feature across ≥2 sources produces exactly one
      cluster file in `brain/clusters/`.
- [ ] `judge` writes a verdict that quotes a specific line from `mission.md`; an on-mission
      cluster is `approved`, an off-mission one is `rejected` and appears in the Rejected lane.
- [ ] An approved cluster results in a real `gh` PR on the target repo with tests passing,
      opened without human keystrokes.
- [ ] `ship` appends one entry to `decisions.md` linking the signals → verdict → PR.
- [ ] Clicking the shipped card in the cockpit shows the full evidence chain resolving to
      real files/PR.

**Proactive loop (second act)**
- [ ] `ideate` writes at least one testable hypothesis to `brain/hypotheses/` derived from
      a weak (2-signal) cluster or a strategy gap.
- [ ] `validate` writes an `experiments/` file with a pass/fail backed by cited signals;
      a validated hypothesis enters the same `judge`→ship pipeline.

**Post-ship memory**
- [ ] A new signal about an already-shipped feature is recognized (Hermes memory) and
      annotated "already handled in decision #N" rather than re-clustered into a new build.

---

## What this deliberately does NOT do
- No standalone control-plane server, no Postgres, no OAuth flows built from scratch.
- No UI that drives Hermes (read-only cockpit only).
- No React Flow brain graph (that's the product; this is the hackathon).
- No auto-merge — the PR is the human gate.

---

## PIVOT (2026-07-11, evening) — Alera is the SME business layer on cloud Hermes

**Trigger:** the Hermes Atlas map (hermesatlas.com) shows 185+ ecosystem repos — 19
GUIs, 11 orchestration control rooms, 30 skill packs — ALL built by builders, for
builders. There is no surface for a non-technical business owner. That's the gap.

**New thesis:** Alera is the business layer on top of *managed, cloud-hosted* Hermes.
The SME owner (any business — generalized, no vertical) never sees a terminal, config,
or the word "agent." They see: their **rules**, a **stream** of what the assistant did
/ wants approval for / refused (with the rule cited), and an **ask box**. Universal
workers every business needs: inbox responder, bookings, reminders, follow-ups,
reviews, rule keeper.

**What survives unchanged:** the 5-verb layer (mission/next/judge/record/ask), the
brain/ folder, the governed loop, the one-screen Home, the declined lane as the trust
moat. **What maps:** mission.md → business rules written via onboarding chat; PR gate
→ the Approve button; signals → WhatsApp/email/reviews/calendar/billing; skills →
workers. **What's deleted from the surface:** all dev vocabulary (PRs, skills files,
L1/L2/L3, cron) — still underneath, never shown.

**Default autonomy: Careful mode** — drafts everything, owner approves; autonomy is
earned per action type. Money messages ALWAYS wait (rule-enforced).

**Demo scenario (generalized "Northline" Shopify apparel stand-in):** review + WhatsApp cluster
→ drafted replies; overdue invoice → reminder awaiting approval (R4); 30% discount ask
→ declined against R3 with a counter-offer; weekend requests ×7 → drift alert on R5.

**Hackathon architecture unchanged** (filesystem contract, state.json projection,
SKILL.md loop, fixtures + one live connector). Managed hosting/OAuth is the company,
not the 8 hours.

---

## Locked decisions (confirmed 2026-07-11)
1. **Connection approach** — **A, filesystem is the interface.** Hermes and the cockpit
   share `brain/`; no API, no DB. MCP (B) is the named v2 productization story.
2. **Ship target** — **a tiny purpose-built demo app** with a fast test suite,
   Sentry-instrumented, in its own GitHub repo. Alera itself is built in the alera folder.
3. **Judge/ship autonomy** — **auto-decide; the PR is the human gate.** No auto-merge.
