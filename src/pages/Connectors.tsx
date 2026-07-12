import { useEffect, useState } from "react";
import { connectors as seed } from "../brain";
import * as Hermes from "../lib/hermesClient";

// Honest connections: the four we've really wired reflect live status from the
// bridge (green when the credential is set in server/.env). Everything else is
// shown as "coming soon" rather than faked as connected.
export function Connectors() {
  const [ch, setCh] = useState<Hermes.ChannelStatus | null>(null);
  useEffect(() => {
    Hermes.channels().then(setCh);
  }, []);

  const live = seed.filter((c) => c.tier === "live");
  const soon = seed.filter((c) => c.tier !== "live");
  const isLive = (key?: string) => (key && ch ? Boolean(ch[key as keyof Hermes.ChannelStatus]) : false);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Connections</h2>
        <p>
          The places your business lives. The ones below are wired end-to-end — add a
          credential and they go live instantly. More are on the way.
        </p>
      </div>

      <div className="conn-section-label">Wired · live when a key is set</div>
      <div className="conn-grid">
        {live.map((c) => {
          const on = isLive(c.statusKey);
          return (
            <div key={c.id} className={`conn ${on ? "connected" : ""}`}>
              <div className="conn-top">
                <span className="conn-name">{c.name}</span>
                {on && <span className="conn-dot" />}
              </div>
              <div className="conn-role">{c.role}</div>
              <div className="conn-detail">{on ? "Live ✓" : `Add key in server/.env`}</div>
              <button className={`conn-btn ${on ? "ghost" : ""}`} disabled>
                {on ? "Connected" : "Awaiting credential"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="conn-section-label">Coming soon</div>
      <div className="conn-grid">
        {soon.map((c) => (
          <div key={c.id} className="conn soon">
            <div className="conn-top">
              <span className="conn-name">{c.name}</span>
              <span className="conn-soon-tag">soon</span>
            </div>
            <div className="conn-role">{c.role}</div>
            <button className="conn-btn" disabled>
              Coming soon
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
