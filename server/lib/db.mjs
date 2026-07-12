// Local SQLite persistence for the live stream (built-in node:sqlite — no deps).
//
// The cockpit's Live Feed / Workers read the in-memory stream, which used to
// reset on every restart. We now mirror each stream item (and its held draft)
// into a small SQLite file so the session survives restarts and the feed is
// there when you reopen the app.

import { DatabaseSync } from "node:sqlite";

let db = null;

export function initDb(path) {
  db = new DatabaseSync(path);
  db.exec(
    `CREATE TABLE IF NOT EXISTS stream_items (
       id TEXT PRIMARY KEY,
       item TEXT NOT NULL,
       draft TEXT,
       created_at INTEGER NOT NULL
     )`
  );
}

// Insert or update one stream item + its draft.
export function saveItem(item, draft) {
  if (!db) return;
  db.prepare(
    `INSERT INTO stream_items (id, item, draft, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET item = excluded.item, draft = excluded.draft`
  ).run(item.id, JSON.stringify(item), draft ? JSON.stringify(draft) : null, Date.now());
}

// Load persisted items, newest first, for hydrating the in-memory stream on boot.
export function loadItems(limit = 100) {
  if (!db) return [];
  const rows = db.prepare(`SELECT item, draft FROM stream_items ORDER BY created_at DESC LIMIT ?`).all(limit);
  return rows.map((r) => ({ item: JSON.parse(r.item), draft: r.draft ? JSON.parse(r.draft) : null }));
}
