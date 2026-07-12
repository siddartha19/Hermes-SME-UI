import { useMemo, useState } from "react";
import { principles, decisions, mission, type Decision } from "../brain";

// A controlled radial map, not a force-directed hairball.
// At rest: mission core + the principles that govern it (beliefs-only).
// Click a principle to expand the decisions it governed (satellites).

const CX = 460;
const CY = 300;
const R1 = 185; // principle ring radius
const RSAT = 96; // satellite distance from its principle

interface PNode {
  id: string;
  text: string;
  x: number;
  y: number;
  angle: number; // radians, core → principle direction
  linked: Decision[];
  influence: number;
}

export function BrainMap() {
  const [expanded, setExpanded] = useState<string | null>("R3");

  const nodes = useMemo<PNode[]>(() => {
    const n = principles.length;
    return principles.map((p, i) => {
      const angle = (-90 + i * (360 / n)) * (Math.PI / 180);
      const linked = decisions.filter((d) => d.evidence.missionLine.startsWith(p.id));
      return {
        id: p.id,
        text: p.text,
        x: CX + R1 * Math.cos(angle),
        y: CY + R1 * Math.sin(angle),
        angle,
        linked,
        influence: linked.length,
      };
    });
  }, []);

  // First-read caption: the two highest-influence principles.
  const top = [...nodes].sort((a, b) => b.influence - a.influence).slice(0, 2);
  const shipped = decisions.filter((d) => d.status === "shipped").length;
  const rejected = decisions.filter((d) => d.status === "rejected").length;

  return (
    <div className="map-wrap">
      <div className="map-caption">
        Your rules at work: <b className="c-ok">{shipped} things handled</b> and{" "}
        <b className="c-no">{rejected} deliberately declined</b> this week — every one traced
        to a rule. Click a rule to see what it decided.
      </div>

      <svg className="map-svg" viewBox="0 0 920 600" role="img">
        <defs>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* core → principle links */}
        {nodes.map((n) => (
          <line
            key={`e-${n.id}`}
            x1={CX}
            y1={CY}
            x2={n.x}
            y2={n.y}
            stroke="var(--line)"
            strokeWidth={n.influence > 0 ? 1.5 : 1}
            opacity={n.influence > 0 ? 0.8 : 0.4}
          />
        ))}

        {/* expanded satellites */}
        {nodes
          .filter((n) => expanded === n.id)
          .map((n) => {
            const k = n.linked.length;
            return n.linked.map((d, j) => {
              const spread = 46 * (Math.PI / 180);
              const a = n.angle + (j - (k - 1) / 2) * spread;
              const sx = n.x + RSAT * Math.cos(a);
              const sy = n.y + RSAT * Math.sin(a);
              const color = d.status === "shipped" ? "var(--ok)" : "var(--no)";
              return (
                <g key={`sat-${n.id}-${j}`}>
                  <line x1={n.x} y1={n.y} x2={sx} y2={sy} stroke={color} strokeWidth={1.5} opacity={0.5} />
                  <circle cx={sx} cy={sy} r={9} fill={color} opacity={0.9} />
                  <text x={sx} y={sy - 15} className="sat-label" textAnchor="middle">
                    {d.title}
                  </text>
                </g>
              );
            });
          })}

        {/* principle nodes */}
        {nodes.map((n) => {
          const r = 16 + n.influence * 7;
          const active = n.influence > 0;
          const isOpen = expanded === n.id;
          return (
            <g
              key={n.id}
              className="pnode"
              onClick={() => setExpanded(isOpen ? null : n.id)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={active ? "#eff6ff" : "#f9fafb"}
                stroke={isOpen ? "#3b82f6" : active ? "#93c5fd" : "#e5e7eb"}
                strokeWidth={isOpen ? 2.5 : 1.5}
              />
              <text x={n.x} y={n.y + 4} className="pnode-id" textAnchor="middle">
                {n.id}
              </text>
              <text x={n.x} y={n.y + r + 15} className={`pnode-text ${active ? "on" : ""}`} textAnchor="middle">
                {n.text}
              </text>
            </g>
          );
        })}

        {/* mission core */}
        <circle cx={CX} cy={CY} r={40} fill="url(#core)" filter="url(#glow)" />
        <text x={CX} y={CY - 2} className="core-label" textAnchor="middle">
          YOUR RULES
        </text>
        <text x={CX} y={CY + 13} className="core-sub" textAnchor="middle">
          the filter
        </text>
      </svg>

      <div className="map-legend">
        <span><i className="lg core" /> your rules</span>
        <span><i className="lg belief" /> rule · size = how often it decides</span>
        <span><i className="lg ok" /> handled</span>
        <span><i className="lg no" /> declined</span>
        <span className="map-hint">busiest rules: {top.map((t) => t.id).join(" + ")} · {mission.text.split("—")[0].trim()}</span>
      </div>
    </div>
  );
}
