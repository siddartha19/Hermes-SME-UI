// Eval harness — run the crew over a fixed, named case set and score it.
//
// This is how we prove the crew improves instead of shipping on vibes. Each
// case has an expected specialist route, an acceptable rule-keeper decision,
// and optional content guards (must NOT offer >10% off; must mention the Sunday
// alternative). We run every case, score route + decision + content, write a
// versioned result file, and print the pass rate.
//
// CI-style gate: exits non-zero if the pass rate drops below the threshold, so
// a prompt change that regresses quality blocks the release.
//
//   node server/eval/run.mjs                 # run active prompt version
//   ALERA_PROMPTS=v2 node server/eval/run.mjs # run a specific version
//   EVAL_MIN=0.8 node server/eval/run.mjs     # set the pass-rate gate

import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initTraceStore } from "../lib/trace.mjs";
import { initOrchestrator, handleInbound } from "../orchestrator.mjs";
import { ACTIVE } from "../prompts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAIN = join(HERE, "..", "..", "brain");
const RESULTS = join(HERE, "results");
const MIN = Number(process.env.EVAL_MIN || 0.8);

initTraceStore(BRAIN);
initOrchestrator(BRAIN);

const stageToDecision = { done: "auto", awaiting: "needs_approval", declined: "decline", inbox: "auto", error: "error" };

function scoreCase(c, r) {
  const specialist = (r.specialist || "").toLowerCase();
  const routeOK = c.specialist.some((s) => specialist.includes(s.toLowerCase()) || s.toLowerCase().includes(specialist));
  const decision = stageToDecision[r.stage] || r.stage;
  const decisionOK = c.decision.includes(decision);
  const draft = (r.draft || "").toLowerCase();
  const forbidOK = c.forbid ? !new RegExp(c.forbid, "i").test(draft) : true;
  const requireOK = c.require ? new RegExp(c.require, "i").test(draft) : true;
  const pass = routeOK && decisionOK && forbidOK && requireOK;
  return { pass, routeOK, decisionOK, forbidOK, requireOK, got: { specialist, decision } };
}

async function main() {
  const cases = JSON.parse(await readFile(join(HERE, "cases.json"), "utf8"));
  const version = ACTIVE;
  console.log(`\n  Eval · prompts=${version} · ${cases.length} cases · gate ${Math.round(MIN * 100)}%\n`);

  const rows = [];
  let passed = 0;
  for (const c of cases) {
    const r = await handleInbound(c.inbound, { customer: `eval-${c.id}`, channel: "eval", version });
    const s = scoreCase(c, r);
    if (s.pass) passed++;
    rows.push({ id: c.id, ...s, inbound: c.inbound });
    const marks = [s.routeOK ? "route" : "ROUTE✗", s.decisionOK ? "decision" : "DECISION✗", s.forbidOK ? "" : "FORBID✗", s.requireOK ? "" : "REQUIRE✗"].filter(Boolean).join(" ");
    console.log(`  ${s.pass ? "✓" : "✗"} ${c.id}  ${s.got.specialist}/${s.got.decision}  ${marks}`);
  }

  const rate = passed / cases.length;
  const result = { version, at: new Date().toISOString(), total: cases.length, passed, rate: Number(rate.toFixed(3)), rows };
  if (!existsSync(RESULTS)) await mkdir(RESULTS, { recursive: true });
  await writeFile(join(RESULTS, `${version}-${Date.now()}.json`), JSON.stringify(result, null, 2));
  await appendFile(join(RESULTS, "history.jsonl"), JSON.stringify({ version, at: result.at, rate: result.rate, passed, total: cases.length }) + "\n");

  console.log(`\n  ${passed}/${cases.length} passed · ${Math.round(rate * 100)}% (${version})`);
  if (rate < MIN) {
    console.log(`  ✗ BELOW GATE (${Math.round(MIN * 100)}%) — release blocked.\n`);
    process.exit(1);
  }
  console.log(`  ✓ passes gate.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
