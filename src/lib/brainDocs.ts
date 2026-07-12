// Brain markdown files — same source the Under the hood page reads.
const rawFiles = import.meta.glob("/brain/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const ROOT_ORDER = ["mission.md", "strategy.md", "product.md", "decisions.md"];
const DIR_ORDER = ["clusters", "verdicts", "hypotheses", "signals"];

const TITLE_MAP: Record<string, string> = {
  "mission.md": "Business Rules",
  "strategy.md": "Strategy",
  "product.md": "Product Information",
  "decisions.md": "Decisions",
};

export interface BrainDoc {
  id: string; // path key
  rel: string;
  name: string;
  dir: string;
  title: string;
  body: string;
  badge?: "Live" | "Lock" | null;
}

function prettyTitle(rel: string, name: string, body: string): string {
  if (TITLE_MAP[name]) return TITLE_MAP[name];
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.replace(/^Signal —\s*/i, "").replace(/^Verdict —\s*/i, "").replace(/^Cluster —\s*/i, "").replace(/^Hypothesis —\s*/i, "");
  return name.replace(/\.md$/, "").replace(/-/g, " ");
}

function sortKey(rel: string, name: string, dir: string): number {
  if (!dir) return idx(ROOT_ORDER, name);
  const di = DIR_ORDER.indexOf(dir);
  return 100 + (di === -1 ? 50 : di) * 20;
}

function idx(order: string[], name: string): number {
  const i = order.indexOf(name);
  return i === -1 ? 99 : i;
}

export function loadBrainDocs(): BrainDoc[] {
  return Object.entries(rawFiles)
    .map(([path, body]) => {
      const rel = path.replace(/^\/brain\//, "");
      const parts = rel.split("/");
      const name = parts[parts.length - 1];
      const dir = parts.length > 1 ? parts[0] : "";
      return {
        id: path,
        rel,
        name,
        dir,
        title: prettyTitle(rel, name, body),
        body,
        badge: name === "mission.md" ? ("Live" as const) : name === "product.md" ? ("Lock" as const) : null,
      };
    })
    .sort((a, b) => {
      const ka = sortKey(a.rel, a.name, a.dir);
      const kb = sortKey(b.rel, b.name, b.dir);
      if (ka !== kb) return ka - kb;
      return a.rel.localeCompare(b.rel);
    });
}
