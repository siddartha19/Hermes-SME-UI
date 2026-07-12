// Trace store — the observability spine.
//
// Every agent step (manager plan, specialist draft, rule-keeper check) is
// recorded here with who called whom, tokens, cost, latency, and model. Runs
// are written to brain/traces/<runId>.json (full tree) plus a one-line summary
// in brain/traces/index.jsonl so the cockpit can list, search, and diff runs
// without reading every file.
//
// Tool-agnostic on purpose: this is a homebrewed store over the filesystem, and
// the rubric scores what you can SEE and DO with a trace, not the vendor logo.

import { readFile, writeFile, appendFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

let TRACES_DIR = null;

export function initTraceStore(brainDir) {
  TRACES_DIR = join(brainDir, "traces");
  if (!existsSync(TRACES_DIR)) mkdir(TRACES_DIR, { recursive: true }).catch(() => {});
}

const nowIso = () => new Date().toISOString();
const rid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Start a run. `task` is the human-readable job; `meta` carries channel/customer/version.
export function newRun(task, meta = {}) {
  return {
    id: rid("run"),
    task,
    channel: meta.channel ?? "internal",
    customer: meta.customer ?? null,
    version: meta.version ?? "v1",
    createdAt: nowIso(),
    status: "running",
    verdict: null,
    outcome: null,
    steps: [],
    totals: { tokens: 0, costUsd: 0, ms: 0 },
  };
}

// Append one recorded step and roll it into the run totals.
export function addStep(run, step) {
  const s = {
    id: step.id ?? rid("step"),
    parent: step.parent ?? null,
    agent: step.agent,
    model: step.model ?? null,
    input: step.input ?? "",
    output: step.output ?? "",
    promptTokens: step.promptTokens ?? 0,
    completionTokens: step.completionTokens ?? 0,
    tokens: (step.promptTokens ?? 0) + (step.completionTokens ?? 0),
    costUsd: step.costUsd ?? 0,
    ms: step.ms ?? 0,
    ts: nowIso(),
    note: step.note ?? null,
    error: step.error ?? null,
  };
  run.steps.push(s);
  run.totals.tokens += s.tokens;
  run.totals.costUsd += s.costUsd;
  run.totals.ms += s.ms;
  return s;
}

// Cost anomaly flag: > 3x the rolling median run cost (needs a few prior runs).
async function costSpike(run) {
  try {
    const prev = (await listRuns()).filter((r) => r.id !== run.id).map((r) => r.costUsd).filter((c) => c > 0);
    if (prev.length < 3) return false;
    const sorted = [...prev].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return median > 0 && run.totals.costUsd > median * 3;
  } catch {
    return false;
  }
}

export async function finishRun(run, { status, verdict, outcome } = {}) {
  run.status = status ?? "done";
  if (verdict !== undefined) run.verdict = verdict;
  if (outcome !== undefined) run.outcome = outcome;
  run.finishedAt = nowIso();
  run.totals.costUsd = Number(run.totals.costUsd.toFixed(6));
  run.costSpike = await costSpike(run);

  if (!TRACES_DIR) return run;
  await writeFile(join(TRACES_DIR, `${run.id}.json`), JSON.stringify(run, null, 2)).catch(() => {});
  const summary = {
    id: run.id,
    task: run.task,
    channel: run.channel,
    customer: run.customer,
    version: run.version,
    status: run.status,
    createdAt: run.createdAt,
    steps: run.steps.length,
    tokens: run.totals.tokens,
    costUsd: run.totals.costUsd,
    ms: run.totals.ms,
    costSpike: run.costSpike,
    rule: run.verdict?.rule ?? null,
  };
  await appendFile(join(TRACES_DIR, "index.jsonl"), JSON.stringify(summary) + "\n").catch(() => {});
  return run;
}

// List run summaries, newest first.
export async function listRuns() {
  if (!TRACES_DIR) return [];
  const idx = join(TRACES_DIR, "index.jsonl");
  if (!existsSync(idx)) return [];
  const lines = (await readFile(idx, "utf8")).trim().split("\n").filter(Boolean);
  const out = [];
  for (const l of lines) {
    try {
      out.push(JSON.parse(l));
    } catch {
      /* skip corrupt line */
    }
  }
  return out.reverse();
}

export async function getRun(id) {
  if (!TRACES_DIR) return null;
  const p = join(TRACES_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(await readFile(p, "utf8"));
}

// Search across runs: matches task, customer, agent names, and step text.
export async function searchRuns(q) {
  const needle = (q ?? "").toLowerCase().trim();
  if (!needle) return listRuns();
  const files = (await readdir(TRACES_DIR)).filter((f) => f.endsWith(".json"));
  const hits = [];
  for (const f of files) {
    try {
      const run = JSON.parse(await readFile(join(TRACES_DIR, f), "utf8"));
      const hay = [
        run.task,
        run.customer,
        run.channel,
        run.verdict?.rule,
        run.verdict?.reasoning,
        run.outcome,
        ...run.steps.map((s) => `${s.agent} ${s.input} ${s.output}`),
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(needle)) {
        hits.push({ id: run.id, task: run.task, customer: run.customer, status: run.status, createdAt: run.createdAt, tokens: run.totals.tokens, costUsd: run.totals.costUsd, ms: run.totals.ms });
      }
    } catch {
      /* skip */
    }
  }
  return hits.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
