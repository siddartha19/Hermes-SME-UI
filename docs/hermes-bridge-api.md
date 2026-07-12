# Alera ↔ Hermes bridge API

The Alera UI talks to Hermes through **one module**: `src/lib/hermesClient.ts`.
Everything two-way (terminal, chat, brain files, workers, approvals) goes through it.

## Turning it on

The UI runs in two modes:

- **Demo (default):** no env var set → local `brain/` + in-memory mock. Nothing to run.
- **Live:** set `VITE_HERMES_URL` (and optionally `VITE_HERMES_TOKEN`) → the UI calls
  your Hostinger Hermes over HTTP.

Create `alera/.env.local`:

```
VITE_HERMES_URL=https://your-hostinger-host:PORT
VITE_HERMES_TOKEN=some-shared-secret
```

Restart `npm run dev`. The top bar flips from **demo** to **Hermes live**.

## What Hermes must expose on Hostinger

A small HTTP service (any language) sitting next to your Hermes instance, backed by
the shared `brain/` folder. All JSON. `Authorization: Bearer <token>` if a token is set.

### READ

| Method | Path | Returns |
|---|---|---|
| GET | `/api/state` | `{ activity: TerminalLine[], stream: StreamItem[], workers: WorkerState[] }` |
| GET | `/api/brain/docs` | `BrainDoc[]` — every file in `brain/**` |
| GET | `/api/brain/doc?rel=signals/x.md` | `{ body: string }` |

The UI polls `/api/state` every ~4s to stay in sync with what Hermes is doing.

### WRITE (control from the UI → Hermes)

| Method | Path | Body | Effect |
|---|---|---|---|
| POST | `/api/command` | `{ text }` | Run a terminal command on Hermes; return the log lines it produced |
| POST | `/api/ask` | `{ question }` | Grounded answer over the brain → `Answer` |
| POST | `/api/approve` | `{ itemId }` | Human approved a pending item → Hermes performs the action |
| POST | `/api/override` | `{ itemId, verdict }` | Human flipped a verdict → Hermes records + acts |
| PUT | `/api/brain/doc` | `{ rel, body }` | Write a brain file back; Hermes re-reads on next loop |
| POST | `/api/worker` | `{ name, enabled }` | Enable/disable a worker |
| POST | `/api/worker/run` | `{ name }` | Trigger one run now; return log lines |

### Types (mirror of `hermesClient.ts` / `brainLayer.ts`)

```ts
TerminalLine = { skill: string; text: string; now?: boolean }
WorkerState  = { name; purpose; runs; lastRun; enabled: boolean }
StreamItem   = { id; title; stage; origin; sources; verdict; outcome?; evidence? }
Answer       = { text; missionLine?; sources: {source;text}[]; confidence }
BrainDoc     = { id; rel; name; dir; title; body; badge? }
```

## Minimal server sketch (Node/Express on Hostinger)

```js
import express from "express";
import fs from "fs/promises";
import { execFile } from "child_process";

const BRAIN = "/path/to/hermes/brain";
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.get("Authorization") !== `Bearer ${process.env.ALERA_TOKEN}`) return res.sendStatus(401);
  next();
});

app.get("/api/state", async (_req, res) => {
  // read brain/state.json that your Hermes loop writes each tick
  res.json(JSON.parse(await fs.readFile(`${BRAIN}/state.json`, "utf8")));
});

app.put("/api/brain/doc", async (req, res) => {
  await fs.writeFile(`${BRAIN}/${req.body.rel}`, req.body.body);
  res.sendStatus(204); // Hermes' cron picks it up on the next loop
});

app.post("/api/approve", async (req, res) => {
  // enqueue for Hermes: append to brain/queue/approved.jsonl, or trigger a skill
  await fs.appendFile(`${BRAIN}/queue/approved.jsonl`, JSON.stringify(req.body) + "\n");
  res.sendStatus(202);
});

// /api/command and /api/worker/run → execFile("hermes", [...]) and return stdout lines
app.listen(process.env.PORT || 8787);
```

## The flow, end to end

```
UI action  ─POST─▶  bridge (Hostinger)  ─writes─▶  brain/queue/*.jsonl
                                                        │
                                          Hermes cron picks it up, acts,
                                          writes results back to brain/ + state.json
                                                        │
UI poll  ◀─GET /api/state──────────────────────────────┘   (updates terminal, feed, workers)
```

Human stays the gate: money actions only fire after an `/api/approve` from the UI.
