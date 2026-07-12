// The agent org — a manager that plans and delegates, specialists that execute,
// a review step that can bounce work back, and a rule keeper that gates the
// send. This is the "team of agents replaces a human function" core: it turns
// one inbound customer message into a decided, rule-checked, ready-to-send
// action, fully traced.

import { readFile, appendFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { newRun, finishRun, addStep } from "./lib/trace.mjs";
import { runAgent, hasModel } from "./lib/agent.mjs";
import { prompts, ACTIVE } from "./prompts.mjs";
import { linkupSearch, linkupEnabled } from "./linkup.mjs";
import { lookupOrder, shopifyEnabled } from "./shopify.mjs";
import { searchCatalog, catalogEnabled } from "./catalog.mjs";

let BRAIN = null;
export function initOrchestrator(brainDir) {
  BRAIN = brainDir;
}

// ── business rules (memory layer 3) ────────────────────────────────────────────
async function loadRules() {
  try {
    const body = await readFile(join(BRAIN, "mission.md"), "utf8");
    const rules = body.match(/- \*\*R\d.*$/gm)?.join("\n") ?? body;
    return rules;
  } catch {
    return "R1 reply within 2h. R2 friendly tone, sign 'Northline team'. R3 never discount >10%. R4 always ask before money messages. R5 warehouse closed Sundays.";
  }
}
async function businessName() {
  try {
    const b = JSON.parse(await readFile(join(new URL(".", import.meta.url).pathname, "business.json"), "utf8"));
    return b?.name || "Northline";
  } catch {
    return "Northline";
  }
}

// Custom workers a non-engineer defined in the UI (brain/workers/*.md front-matter).
// The manager reads these so a brand-new role is immediately delegable.
async function loadCustomWorkers() {
  const dir = join(BRAIN, "workers");
  if (!existsSync(dir)) return "";
  const out = [];
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".md")) continue;
    const body = await readFile(join(dir, f), "utf8");
    const name = body.match(/name:\s*(.+)/)?.[1]?.trim();
    const job = body.match(/job:\s*(.+)/)?.[1]?.trim();
    if (name) out.push(`"${name}" (${job || "custom worker"})`);
  }
  return out.join(", ");
}

// ── customer memory (layer 2: this customer's past) ────────────────────────────
function customerId(meta) {
  return (meta.customer || "unknown").replace(/[^a-zA-Z0-9_+.-]/g, "_");
}
async function loadHistory(meta) {
  const p = join(BRAIN, "customers", `${customerId(meta)}.md`);
  if (!existsSync(p)) return "";
  return (await readFile(p, "utf8")).slice(-2000);
}
async function rememberInteraction(meta, summary) {
  const dir = join(BRAIN, "customers");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true }).catch(() => {});
  const line = `- ${new Date().toISOString()} · ${summary}\n`;
  await appendFile(join(dir, `${customerId(meta)}.md`), line).catch(() => {});
}

// ── the run ─────────────────────────────────────────────────────────────────────
// meta: { channel, customer, version }
export async function handleInbound(inbound, meta = {}) {
  const P = prompts(meta.version || ACTIVE);
  const version = P.version;
  const run = newRun(inbound.slice(0, 80), { channel: meta.channel, customer: meta.customer, version });

  if (!hasModel) {
    await finishRun(run, { status: "error", outcome: "No model credential (OPENAI_API_KEY)." });
    return toResult(run, { draft: "", plan: null });
  }

  const rules = await loadRules();
  const business = await businessName();
  const history = await loadHistory(meta);
  const extraWorkers = await loadCustomWorkers();
  const ctx = { rules, business, history, inbound };

  // 1) manager plans + delegates
  const mgr = await runAgent(run, { agent: "manager", note: "plan", ...P.manager({ ...ctx, extraWorkers }) });
  const plan = mgr.json || { specialist: "inbox responder", subtasks: ["reply to the customer"], touchesMoney: /refund|invoice|pay|money|owe|discount/i.test(inbound), intent: "message", reason: "fallback" };
  const specialist = plan.specialist || "inbox responder";
  const managerStepId = mgr.step.id;

  // 1b) optional live research (Linkup) when the manager asks for external facts
  let research = "";
  if (plan.needsResearch && plan.researchQuery && linkupEnabled()) {
    const t0 = Date.now();
    try {
      const { answer, sources } = await linkupSearch(plan.researchQuery);
      research = `${answer}\nSources: ${sources.map((s) => s.name).join("; ")}`;
      addStep(run, { agent: "researcher", parent: managerStepId, model: "linkup", note: "web search", input: plan.researchQuery, output: research, ms: Date.now() - t0 });
    } catch (e) {
      addStep(run, { agent: "researcher", parent: managerStepId, model: "linkup", note: "web search", input: plan.researchQuery, ms: Date.now() - t0, error: String(e.message || e) });
    }
  }

  // 1c) optional live order lookup (Shopify) for order/tracking/return questions
  let order = "";
  if (plan.needsOrder && plan.orderQuery && shopifyEnabled()) {
    const t0 = Date.now();
    try {
      const { summary } = await lookupOrder(plan.orderQuery);
      order = summary;
      addStep(run, { agent: "shopify", parent: managerStepId, model: "shopify", note: "order lookup", input: plan.orderQuery, output: order, ms: Date.now() - t0 });
    } catch (e) {
      addStep(run, { agent: "shopify", parent: managerStepId, model: "shopify", note: "order lookup", input: plan.orderQuery, ms: Date.now() - t0, error: String(e.message || e) });
    }
  }

  // 1d) optional product catalog lookup (real Shopify export) for product questions
  let catalog = "";
  if (plan.needsCatalog && plan.catalogQuery && catalogEnabled()) {
    const t0 = Date.now();
    const { summary } = searchCatalog(plan.catalogQuery);
    catalog = summary;
    addStep(run, { agent: "catalog", parent: managerStepId, model: "catalog", note: "product lookup", input: plan.catalogQuery, output: catalog, ms: Date.now() - t0 });
  }

  // 2) specialist drafts (handoff: manager → specialist)
  let draft = (await runAgent(run, { agent: specialist, parent: managerStepId, note: "draft", ...P.specialist({ specialist, ...ctx, plan, research, order, catalog }) })).text;

  // 3) manager reviews; bounce back once if not accepted (dynamic review loop)
  const review = await runAgent(run, { agent: "manager", parent: managerStepId, note: "review", ...P.reviewer({ business, inbound, draft, rules }) });
  if (review.json && review.json.accept === false && review.json.note) {
    draft = (await runAgent(run, { agent: specialist, parent: managerStepId, note: "revision", ...P.specialist({ specialist, ...ctx, plan, revisionNote: review.json.note }) })).text;
  }

  // 4) rule keeper gates the send (shared guardrail across every action)
  const rk = await runAgent(run, { agent: "rule keeper", parent: managerStepId, note: "check", ...P.rulekeeper({ rules, business, inbound, draft }) });
  const decision = rk.json?.decision || (plan.touchesMoney ? "needs_approval" : "auto");
  const rule = rk.json?.rule || (plan.touchesMoney ? "R4 ask before money-related messages" : "R1 reply within 2 hours");
  const reasoning = rk.json?.reasoning || "";

  const status = decision === "decline" ? "declined" : decision === "needs_approval" ? "awaiting" : "done";
  const verdict = { status: decision === "decline" ? "rejected" : decision === "needs_approval" ? "pending" : "approved", rule, reasoning };
  const outcome = status === "done" ? "auto-sent" : status === "awaiting" ? "waiting for owner approval" : "declined — drafted a compliant alternative";

  await finishRun(run, { status, verdict, outcome });
  await rememberInteraction(meta, `${plan.intent || "message"} → ${status} (${rule})`);

  // Closed-loop: anything escalated to a human becomes a candidate eval case, so
  // the eval set grows from real failures instead of staying frozen.
  if ((status === "awaiting" || status === "declined") && meta.channel !== "eval") {
    const cap = join(new URL(".", import.meta.url).pathname, "eval", "captured.jsonl");
    await appendFile(cap, JSON.stringify({ id: run.id, inbound, specialist: [specialist], decision: [decision], rule, at: run.createdAt }) + "\n").catch(() => {});
  }

  return toResult(run, { draft, plan, specialist });
}

function toResult(run, { draft, plan, specialist }) {
  return {
    runId: run.id,
    stage: run.status === "done" ? "done" : run.status === "awaiting" ? "awaiting" : run.status === "declined" ? "declined" : "inbox",
    title: run.task,
    specialist: specialist || plan?.specialist || "inbox responder",
    plan,
    draft,
    verdict: run.verdict,
    outcome: run.outcome,
    totals: run.totals,
    version: run.version,
  };
}
