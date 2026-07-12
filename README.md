# Hermes SME

A control panel that lets a small business owner run a self-directed
[Hermes](https://github.com/NousResearch) agent — no terminal, no config, no
"agent" jargon. The owner sees their **rules**, a **live feed** of what the
assistant did / wants approval for / declined (with the reason), an **ask box**,
and their **documents**. The assistant is named **Alera**.

It's a two-way GUI over a real, locally-running Hermes agent: read what the agent
is doing, and drive it — chat, approvals, brain documents, and workers — from one
screen.

```
  Browser (5173)            Hermes SME UI              Hermes agent (CLI)
  ┌───────────┐   http/poll  ┌──────────┐   exec/files  ┌────────────────┐
  │  cockpit  │ ◀──────────▶ │  adapter │ ◀───────────▶ │  brain/ · memory│
  └───────────┘   :5173      │  :8787   │               └────────────────┘
                             └──────────┘
```

## Quick start

Two terminals, from this folder:

```bash
npm install
npm run hermes    # bridge to your local Hermes agent → http://localhost:8787
npm run dev       # UI → http://localhost:5173
```

Then create `.env.local` to point the UI at the adapter:

```
VITE_HERMES_URL=http://localhost:8787
```

Without it, the UI runs in a self-contained **demo** mode (no agent required).

See **[SETUP.md](./SETUP.md)** for the full zero-to-running guide, and
**[docs/hermes-bridge-api.md](./docs/hermes-bridge-api.md)** for the adapter API
contract.

## What's inside

- **UI** — React + TypeScript + Vite. Single-page cockpit: Company (docs), Today,
  Workers, Live Feed, and Talk to Alera.
- **Adapter** (`server/hermes-adapter.mjs`) — a thin, zero-dependency bridge that
  shells out to the real `hermes` CLI and serves the shared `brain/` folder.
- **`brain/`** — plain Markdown the agent reads and writes (rules, strategy,
  product, decisions, signals, …). Editing a document here is what "programs" the
  assistant.

## Prerequisites

- Node.js 20+
- A locally installed, authenticated [Hermes agent](https://github.com/NousResearch)
  (`hermes model` to pick a provider). The demo mode needs neither.

## Tech

React 19 · TypeScript · Vite · Node (adapter) · Nous Research Hermes (runtime).
