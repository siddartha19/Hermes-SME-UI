import { useState } from "react";
import * as Hermes from "../lib/hermesClient";
import { connectors } from "../brain";

// A non-engineer defines a brand-new worker role: what it does, which tools it
// may use, and its guardrail. On save it's written to the brain and the manager
// agent can immediately delegate to it — no code, no redeploy.
export function AddWorker({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [autonomy, setAutonomy] = useState<"auto" | "careful">("careful");
  const [guardrail, setGuardrail] = useState("");
  const [saved, setSaved] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testOut, setTestOut] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const toggleTool = (id: string) => setTools((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  async function save() {
    if (!name.trim() || !job.trim()) return;
    await Hermes.defineWorker({ name: name.trim(), job: job.trim(), tools, autonomy, guardrail: guardrail.trim() });
    setSaved(true);
  }

  async function test() {
    if (!testMsg.trim()) return;
    setTesting(true);
    setTestOut(null);
    try {
      await Hermes.sendInbound(testMsg.trim(), "test-volunteer", "telegram");
      setTestOut(`Sent to the crew. Open Observability to see the manager route it${saved ? ` — it can now pick "${name}".` : "."}`);
    } catch {
      setTestOut("Could not reach the crew.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="addw">
      <label className="field">
        <span>Worker name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. loyalty concierge" />
      </label>
      <label className="field">
        <span>What it does (the job)</span>
        <textarea value={job} onChange={(e) => setJob(e.target.value)} rows={3} placeholder="Spots repeat customers and offers them early access to new drops (within the discount rule)." />
      </label>
      <div className="field">
        <span>Tools it may use</span>
        <div className="addw-tools">
          {connectors.map((c) => (
            <button key={c.id} type="button" className={`addw-tool ${tools.includes(c.id) ? "on" : ""}`} onClick={() => toggleTool(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Autonomy guardrail</span>
        <div className="addw-auto">
          <button type="button" className={autonomy === "careful" ? "on" : ""} onClick={() => setAutonomy("careful")}>
            Careful — drafts, waits for your OK
          </button>
          <button type="button" className={autonomy === "auto" ? "on" : ""} onClick={() => setAutonomy("auto")}>
            Auto — handles routine itself
          </button>
        </div>
      </div>
      <label className="field">
        <span>Extra guardrail (optional)</span>
        <input value={guardrail} onChange={(e) => setGuardrail(e.target.value)} placeholder="e.g. never contact a customer more than once a week" />
      </label>

      <div className="modal-actions" style={{ padding: 0 }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={!name.trim() || !job.trim()}>
          {saved ? "Saved ✓ — manager can delegate to it" : "Create worker"}
        </button>
      </div>

      {saved && (
        <div className="addw-test">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Test it — send a message this worker should handle:</span>
          <input style={{ marginTop: 6 }} value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="Type a customer message…" />
          <div className="modal-actions" style={{ padding: 0, marginTop: 8 }}>
            <button className="btn-primary" onClick={test} disabled={testing || !testMsg.trim()}>
              {testing ? "Running…" : "Send to crew"}
            </button>
          </div>
          {testOut && <pre>{testOut}</pre>}
        </div>
      )}
    </div>
  );
}
