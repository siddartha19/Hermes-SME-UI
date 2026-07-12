import { skills } from "../brain";

export function Skills() {
  return (
    <div className="page">
      <div className="page-head">
        <h2>Workers</h2>
        <p>
          The jobs your assistant runs for you, around the clock. Every worker checks your
          rules before acting, and they get better the longer they work for you.
        </p>
      </div>
      <div className="skill-grid">
        {skills.map((s) => (
          <div key={s.name} className="skill">
            <div className="skill-top">
              <code className="skill-name">{s.name}</code>
              <span className={`arm ${s.arm}`}>
                {s.arm === "reactive" ? "responds" : s.arm === "proactive" ? "takes initiative" : "always on"}
              </span>
            </div>
            <div className="skill-purpose">{s.purpose}</div>
            <div className="skill-meta">
              {s.runs} times this month · last {s.lastRun}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
