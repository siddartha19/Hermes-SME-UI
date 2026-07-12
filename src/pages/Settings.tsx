import { useState } from "react";
import { mission, settings } from "../brain";

export function Settings() {
  const [autoDecide, setAutoDecide] = useState(false);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Settings</h2>
        <p>How your assistant runs, and how much it's allowed to do on its own.</p>
      </div>

      <div className="settings">
        <div className="setting">
          <div className="setting-k">Your rules</div>
          <div className="setting-v">
            {mission.text}
            <div className="clause-list">
              {mission.clauses.map((c) => (
                <span key={c.id} className="clause">
                  <b>{c.id}</b> {c.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="setting">
          <div className="setting-k">Where it runs</div>
          <div className="setting-v mono">{settings.connection}</div>
        </div>

        <div className="setting">
          <div className="setting-k">Your business file</div>
          <div className="setting-v mono">{settings.brainPath}</div>
        </div>

        <div className="setting">
          <div className="setting-k">Working hours</div>
          <div className="setting-v mono">{settings.cron}</div>
        </div>

        <div className="setting">
          <div className="setting-k">Autonomy</div>
          <div className="setting-v">
            <button
              className={`toggle ${autoDecide ? "on" : ""}`}
              onClick={() => setAutoDecide((v) => !v)}
            >
              <span className="knob" />
            </button>
            <span className="toggle-label">
              {autoDecide
                ? "Trusted mode — sends routine things itself, asks for the rest"
                : "Careful mode — drafts everything, you approve before anything goes out"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
