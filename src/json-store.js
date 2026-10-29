// File-backed store for the GitHub Actions pipeline. Only published articles go to the
// public snapshot; held drafts stay in the (also public) seen-journal as headlines only.
import {readFile, writeFile, rename} from 'node:fs/promises';

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
// Writes are queued so overlapping saves never share the temporary file.
let queue = Promise.resolve();
function writeJson(path, data) {
  const text = JSON.stringify(data, null, 2) + '\n';
  queue = queue.catch(() => {}).then(async () => { await writeFile(path + '.tmp', text); await rename(path + '.tmp', path); });
  return queue;
}

export async function openJsonStore({publishedPath, seenPath, keepDays = 7, now = new Date()}) {
  const snapshot = await readJson(publishedPath, {schemaVersion: 1, articles: []});
  let journal = await readJson(seenPath, []);
  journal = journal.filter(s => now - Date.parse(s.at) < keepDays * 86400000);
  // Already-published URLs are always "seen", even after the journal is pruned.
  const fromSnapshot = snapshot.articles.flatMap(a => (a.sources || [a.source]).map(s => ({url: s.url, title: a.originalTitle || a.title?.en, category: a.category})));
  return {
    async seen() { return [...fromSnapshot, ...journal]; },
    async markSeen(entry) { journal.push(entry); await writeJson(seenPath, journal); },
    async save(article) {
      if (article.status !== 'published') return;
      snapshot.articles = [article, ...snapshot.articles.filter(a => a.id !== article.id)]
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      snapshot.builtAt = new Date().toISOString();
      snapshot.verification = 'Agent pipeline: search, independent verification by a second agent with at least two independent sources, bilingual rewrite; plus deterministic first-party release checks';
      await writeJson(publishedPath, snapshot);
    },
  };
}
