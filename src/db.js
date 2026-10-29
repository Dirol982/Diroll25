// SQLite storage for the VPS deployment (Node's built-in node:sqlite, WAL mode so
// the web server and the worker can share one file).
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader','advertiser','editor','admin')),
  language TEXT NOT NULL DEFAULT 'ru',
  topics TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  category TEXT NOT NULL,
  published_at TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS articles_status ON articles(status, published_at);
CREATE TABLE IF NOT EXISTS seen (
  url TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  decision TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, article_id)
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  placement TEXT NOT NULL,
  topics TEXT NOT NULL,
  languages TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  click_url TEXT NOT NULL,
  advertiser_name TEXT NOT NULL,
  erid TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  moderation_note TEXT NOT NULL DEFAULT '',
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  external_id TEXT,
  invoice_url TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE TABLE IF NOT EXISTS telegram_posts (
  key TEXT PRIMARY KEY,
  article_id TEXT,
  campaign_id INTEGER,
  channel TEXT NOT NULL,
  language TEXT NOT NULL,
  status TEXT NOT NULL,
  message_id INTEGER,
  error TEXT,
  attempted_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_by INTEGER,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  result TEXT
);
`;

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true});
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

export const nowIso = () => new Date().toISOString();
const parse = row => row && JSON.parse(row.data);

export function articleRepo(db) {
  const upsert = db.prepare(`INSERT INTO articles (id, status, category, published_at, data) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, category = excluded.category, published_at = excluded.published_at, data = excluded.data`);
  return {
    save(a) { upsert.run(a.id, a.status, a.category, a.publishedAt || null, JSON.stringify(a)); },
    get(id) { return parse(db.prepare('SELECT data FROM articles WHERE id = ?').get(id)); },
    byStatus(status, limit = 200) { return db.prepare('SELECT data FROM articles WHERE status = ? ORDER BY published_at DESC LIMIT ?').all(status, limit).map(parse); },
    count() { return db.prepare('SELECT COUNT(*) AS n FROM articles').get().n; },
  };
}

// Same interface as the JSON store, so runPipeline works unchanged on the VPS.
export function pipelineStore(db) {
  const articles = articleRepo(db);
  return {
    async seen() {
      const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
      const journal = db.prepare("SELECT url, title, category, decision, at FROM seen WHERE at > ? OR decision = 'published'").all(cutoff);
      const published = articles.byStatus('published', 500).flatMap(a => (a.sources || [a.source]).map(s => ({url: s.url, title: a.originalTitle || a.title.en, category: a.category})));
      return [...journal.map(r => ({...r})), ...published];
    },
    async markSeen(e) { db.prepare('INSERT OR REPLACE INTO seen (url, title, category, decision, at) VALUES (?, ?, ?, ?, ?)').run(e.url, e.title, e.category, e.decision, e.at); },
    async save(article) { articles.save(article); },
  };
}
