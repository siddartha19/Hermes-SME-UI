// Smoke test: run a few inbound messages through the crew and print the trace.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initTraceStore, getRun } from "./lib/trace.mjs";
import { initOrchestrator, handleInbound } from "./orchestrator.mjs";

const BRAIN = join(dirname(fileURLToPath(import.meta.url)), "..", "brain");
initTraceStore(BRAIN);
initOrchestrator(BRAIN);

const cases = [
  { inbound: "Hi! Do you have the kids joggers in size 6? And when would they arrive in Pune?", customer: "+91-98xx-1", channel: "telegram" },
  { inbound: "We'd order 120 shirts a month if you can do 30% off. Deal?", customer: "buyer@campus.edu", channel: "email" },
  { inbound: "Can you ship my order so it arrives this Sunday? It's urgent.", customer: "+91-98xx-2", channel: "telegram" },
];

for (const c of cases) {
  const r = await handleInbound(c.inbound, { customer: c.customer, channel: c.channel });
  const run = await getRun(r.runId);
  console.log("\n=== ", c.inbound.slice(0, 60), "===");
  console.log("stage:", r.stage, "| specialist:", r.specialist, "| rule:", r.verdict?.rule);
  console.log("steps:", run.steps.map((s) => `${s.agent}/${s.note}(${s.tokens}t,$${s.costUsd.toFixed(4)},${s.ms}ms)`).join(" → "));
  console.log("totals:", run.totals, "| version:", r.version);
  console.log("draft:", (r.draft || "").slice(0, 200));
}
console.log("\nDONE");
