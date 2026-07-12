import { useState } from "react";
import { decisions } from "../brain";

export function Decisions() {
  const [open, setOpen] = useState<string | null>(decisions[0]?.id ?? null);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Activity</h2>
        <p>
          Everything your assistant did — and deliberately didn't do — with the full story
          behind each one. Nothing happens without a reason you can read.
        </p>
      </div>

      <div className="decision-list">
        {decisions.map((d) => {
          const isOpen = open === d.id;
          const ev = d.evidence;
          return (
            <div key={d.id} className={`decision ${d.status}`}>
              <button className="decision-head" onClick={() => setOpen(isOpen ? null : d.id)}>
                <span className={`pill ${d.status}`}>
                  {d.status === "shipped" ? "done" : "didn't do"}
                </span>
                <span className="decision-title">{d.title}</span>
                <span className="decision-mission">{ev.missionLine}</span>
                <span className="chev">{isOpen ? "▾" : "▸"}</span>
              </button>

              {isOpen && (
                <div className="decision-body">
                  <div className="step-label">What came in</div>
                  {ev.signals.map((s, i) => (
                    <div key={i} className="chain-signal">
                      <span className={`src ${s.source}`}>{s.source}</span>
                      <span>{s.text}</span>
                    </div>
                  ))}
                  <div className="step-label">Rule check</div>
                  <div className={`verdict ${ev.missionStatus === "fail" ? "no" : "ok"}`}>
                    {ev.missionStatus === "fail" ? "✕ Didn't do it" : "✓ Handled"} · {ev.missionLine}
                  </div>
                  <div className="reasoning">{ev.reasoning}</div>
                  {ev.spec && (
                    <>
                      <div className="step-label">The draft</div>
                      <code className="spec">{ev.spec}</code>
                    </>
                  )}
                  {ev.pr && (
                    <>
                      <div className="step-label">Result</div>
                      <div className="pr">{ev.pr}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
