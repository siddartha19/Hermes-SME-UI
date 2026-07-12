import { useMemo, useState } from "react";
import { marked } from "marked";

// Reads the real brain/ Markdown folder at the project root. In dev, editing any
// brain file hot-reloads this page — so when Hermes writes to brain/, you see it here.
const files = import.meta.glob("/brain/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const ROOT_ORDER = ["mission.md", "strategy.md", "product.md", "decisions.md"];
const DIR_ORDER = ["signals", "clusters", "verdicts", "hypotheses", "experiments", "customers", "workers", "traces"];
const TITLES: Record<string, string> = {
  "mission.md": "Business Rules",
  "strategy.md": "Strategy",
  "product.md": "Product Information",
  "decisions.md": "Decisions",
};

interface Entry {
  path: string;
  rel: string;
  dir: string;
  name: string;
}

function buildEntries(): Entry[] {
  return Object.keys(files).map((path) => {
    const rel = path.replace("/brain/", "");
    const parts = rel.split("/");
    return { path, rel, name: parts[parts.length - 1], dir: parts.length > 1 ? parts[0] : "" };
  });
}

export function Brain() {
  const entries = useMemo(buildEntries, []);
  const [open, setOpen] = useState<string | null>(null);

  const rootFiles = entries
    .filter((e) => e.dir === "")
    .sort((a, b) => idx(ROOT_ORDER, a.name) - idx(ROOT_ORDER, b.name));

  const dirs = DIR_ORDER.map((d) => ({
    dir: d,
    items: entries.filter((e) => e.dir === d).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);

  const label = (e: Entry) => TITLES[e.name] ?? e.name;

  const row = (e: Entry) => (
    <div key={e.path} className="uh-file-wrap">
      <button className={`uh-file ${open === e.path ? "on" : ""}`} onClick={() => setOpen(open === e.path ? null : e.path)}>
        <span className="uh-ico">📄</span>
        <span className="uh-name">{label(e)}</span>
        <code className="uh-rel">{e.rel}</code>
        <span className="uh-chev">{open === e.path ? "▾" : "▸"}</span>
      </button>
      {open === e.path && (
        <div className="uh-content markdown" dangerouslySetInnerHTML={{ __html: marked.parse(files[e.path] ?? "") as string }} />
      )}
    </div>
  );

  return (
    <div className="uh">
      <div className="uh-note">
        Everything Alera knows lives here as plain files — your rules, memory, and every decision. This is the brain.
      </div>
      <div className="uh-group">
        <div className="uh-group-h">brain/</div>
        {rootFiles.map(row)}
      </div>
      {dirs.map((g) => (
        <div className="uh-group" key={g.dir}>
          <div className="uh-group-h">
            {g.dir}/ <span className="uh-count">{g.items.length}</span>
          </div>
          {g.items.map(row)}
        </div>
      ))}
    </div>
  );
}

function idx(order: string[], name: string): number {
  const i = order.indexOf(name);
  return i === -1 ? 999 : i;
}
