# Alera — Setup from Zero

This guide takes you from nothing to a running Alera cockpit wired two-way to a
local Hermes runtime. No prior context needed.

**What you're setting up:**

```
  You (browser)                Alera UI                 Hermes (runtime)
  ┌───────────┐   http/poll   ┌──────────┐   files    ┌────────────────┐
  │  cockpit  │ ◀───────────▶ │  bridge  │ ◀────────▶ │  brain/  (md)  │
  └───────────┘   :5173       │  :8787   │            │  state.json    │
                              └──────────┘            └────────────────┘
```

- **Alera UI** — the dark terminal cockpit (Vite + React).
- **Hermes** — the agent runtime that reads your rules from `brain/`, acts, and
  writes results back. For local dev we ship a tiny stand-in (`npm run hermes`).
- **`brain/`** — a folder of Markdown files. This is the shared contract: Hermes
  reads/writes it, the UI shows it. Edit a rule in the UI → the file changes on disk.

---

## 0. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20+ (22 recommended) | `node --version` |
| npm | 10+ | `npm --version` |
| git | any | `git --version` |

No database, no Docker, no cloud account required for local dev.

---

## 1. Get the code

```bash
git clone <your-repo-url> alera-project
cd alera-project/alera
```

Everything below runs from the `alera/` folder.

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Understand the `brain/` folder (the source of truth)

```
brain/
  mission.md          # your business rules (R1–R5)
  strategy.md         # what matters right now
  product.md          # facts the assistant uses to sound like you
  decisions.md        # log of what was done / declined
  signals/            # incoming events (a message, a review, an order)
  clusters/           # grouped signals the agent noticed
  verdicts/           # rule checks + reasoning
  hypotheses/         # proactive ideas
```

Any `.md` file here shows up in the UI's **Documents** list and is editable.
This is how you "program" the agent — in plain English, not code.

---

## 4. Run Hermes (the runtime)

For local dev, use the built-in bridge — it serves `brain/` + a mutable
`state.json` over the API the UI expects.

```bash
npm run hermes
```

You should see:

```
  Hermes (local) → http://localhost:8787
  brain/         → .../alera/brain
```

Leave this running in its own terminal.

> **Using a real Hermes instead?** Skip this step and point the UI (step 5) at
> your Hermes URL. It just needs to answer the endpoints in
> `docs/hermes-bridge-api.md`, backed by the same `brain/` folder.

---

## 5. Connect the UI to Hermes

Create `alera/.env.local`:

```bash
echo "VITE_HERMES_URL=http://localhost:8787" > .env.local
```

Optional auth (must match `ALERA_TOKEN` on the server):

```bash
echo "VITE_HERMES_TOKEN=some-shared-secret" >> .env.local
```

- **With `.env.local`** → the UI is **live** (talks to Hermes).
- **Without it** → the UI runs in **demo** mode (local mock, no server needed).

---

## 6. Run the app

In a second terminal (from `alera/`):

```bash
npm run dev
```

Open **http://localhost:5173**.

The top bar shows a green **HERMES LIVE** tag when connected (or **demo** if not).

---

## 7. Run the events (the demo loop)

Now drive it two-way. Each action below is a real round trip to Hermes.

### a) Watch the terminal
Top strip streams what Hermes is doing (`> [draft] …`, `> [check] …`). It polls
every 4 seconds.

### b) Send a command
Type in the terminal input bar (e.g. `run reviews worker now`) and press Enter.
It POSTs to Hermes and the response appears in the log.

### c) Ask a question
In **Talk to Alera** (right column), ask something like
*"why was the discount declined?"*. The answer is grounded in your `brain/` files.

### d) Approve an action
In **Workers Feed**, open a worker with an item **"needs your OK"** →
**Approve & send**. This is the human gate — money actions only fire here.

### e) Edit a rule (and see the file change)
Open **Documents → Business Rules** → **Edit** → change a rule → **Save**.
The UI writes the real `brain/mission.md` on disk. Confirm:

```bash
cat brain/mission.md
```

### f) Feed a new signal (simulate an incoming event)
Drop a file into `brain/signals/` and Hermes picks it up:

```bash
cat > brain/signals/$(date +%F)-new-message.md <<'EOF'
# Signal — WhatsApp

**Source:** WhatsApp · just now

"Do you have the blue shirt in size M? Need it by Friday."
EOF
```

It appears in the **Documents** list; on the next loop Hermes can cluster/judge it.

---

## 8. Everyday commands

| Command | What it does |
|---|---|
| `npm run hermes` | Start the local Hermes bridge (:8787) |
| `npm run dev` | Start the UI (:5173) |
| `npm run build` | Type-check + production build |
| `npm run lint` | Lint |
| `npm run preview` | Serve the production build |

Typical dev session: **two terminals** — one `npm run hermes`, one `npm run dev`.

---

## 9. Switch between demo and live

- **Go live:** create `.env.local` with `VITE_HERMES_URL`, restart `npm run dev`.
- **Go demo:** delete `.env.local`, restart `npm run dev`.

(Vite reads env vars at startup, so restart after changing `.env.local`.)

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| Terminal/feed empty, tag says HERMES LIVE | Is `npm run hermes` running? `curl http://localhost:8787/api/state` |
| `ERR_CONNECTION_REFUSED` at :5173 | `npm run dev` isn't running |
| Edits don't persist | You're in demo mode — add `.env.local` and restart |
| Port 8787 busy | `PORT=9000 npm run hermes` and set `VITE_HERMES_URL=http://localhost:9000` |
| 401 from the bridge | `VITE_HERMES_TOKEN` must equal the server's `ALERA_TOKEN` |

---

## 11. Going to production (later)

- Deploy your **real Hermes** (e.g. on a VPS) with a small HTTP bridge implementing
  `docs/hermes-bridge-api.md`, backed by a persistent `brain/` folder.
- Point `VITE_HERMES_URL` at that host, add `VITE_HERMES_TOKEN`.
- Build the UI with `npm run build` and host `dist/` anywhere static.

The UI never changes — it talks to whatever answers on `VITE_HERMES_URL`.

---

## Reference

- **Bridge API contract:** `docs/hermes-bridge-api.md`
- **Local Hermes server:** `server/hermes-local.mjs`
- **UI ↔ Hermes client:** `src/lib/hermesClient.ts`
- **Product/architecture notes:** `docs/hermes-alera-control-panel.md`
