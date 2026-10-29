// Background worker for the VPS: agent newsroom on a schedule, Telegram delivery,
// campaign start/finish and sponsored Telegram posts, daily email digest.
// Run exactly one worker per database, otherwise Telegram posts could be sent twice.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openDatabase, articleRepo, pipelineStore, nowIso} from './db.js';
import {runPipeline} from './pipeline.js';
import {createAgentClient, selectedProvider} from './agents/provider.js';
import {campaignService} from './ads.js';
import {backfillImages} from './images.js';
import {channelsForArticle, telegramURL, formatArticlePost, formatAdPost, sendTelegram, TelegramRejected} from '../telegram.js';
import {Subscriptions, brevoSender, validEmail} from '../subscriptions.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dataDir = process.env.ATLAS_DATA_DIR || root + 'data';
const readJson = async path => JSON.parse(await readFile(root + path, 'utf8'));
const connections = await readJson('config/connections.json');
const {topics} = await readJson('config/topics.json');
const packages = await readJson('config/ad-packages.json');
const publicUrl = process.env.ATLAS_PUBLIC_URL;
const siteUrl = publicUrl ? new URL('/a/', publicUrl).href : connections.siteUrl;
const db = openDatabase(process.env.ATLAS_DB || dataDir + '/atlas.db');
const articles = articleRepo(db);
const campaigns = campaignService(db, {packages, topicIds: topics.map(t => t.id)});
const intervalMinutes = Math.max(15, Number(process.env.ATLAS_PIPELINE_INTERVAL_MINUTES || 60));
const token = process.env.TELEGRAM_BOT_TOKEN;
const telegramOn = process.env.ATLAS_TELEGRAM_DELIVERY === '1' && !!token;

// A worker that died mid-run leaves jobs "running"; they are closed, not retried.
db.prepare("UPDATE jobs SET status = 'interrupted', finished_at = ? WHERE status = 'running'").run(nowIso());
// Same for Telegram: an unfinished send is "uncertain" and is never retried automatically.
db.prepare("UPDATE telegram_posts SET status = 'uncertain' WHERE status = 'sending'").run();

async function runNewsroom() {
  const job = db.prepare("SELECT * FROM jobs WHERE kind = 'newsroom' AND status = 'queued' ORDER BY id LIMIT 1").get();
  const last = db.prepare("SELECT created_at FROM jobs WHERE kind = 'newsroom' ORDER BY id DESC LIMIT 1").get();
  const due = !last || Date.now() - Date.parse(last.created_at) >= intervalMinutes * 60000;
  if (!job && !due) return;
  if (!selectedProvider()) { if (job) db.prepare("UPDATE jobs SET status = 'failed', finished_at = ?, result = ? WHERE id = ?").run(nowIso(), JSON.stringify({error: 'No AI key: set GEMINI_API_KEY or ANTHROPIC_API_KEY'}), job.id); return; }
  const id = job ? job.id : Number(db.prepare("INSERT INTO jobs (kind, status, created_at) VALUES ('newsroom', 'queued', ?)").run(nowIso()).lastInsertRowid);
  db.prepare("UPDATE jobs SET status = 'running', started_at = ? WHERE id = ?").run(nowIso(), id);
  try {
    const report = await runPipeline({
      client: createAgentClient(), store: pipelineStore(db), topics,
      perTopic: Number(process.env.ATLAS_STORIES_PER_TOPIC || 2),
      maxStories: Number(process.env.ATLAS_MAX_STORIES_PER_RUN || 6),
      autoPublish: process.env.ATLAS_AUTO_PUBLISH !== '0',
    });
    report.imagesBackfilled = await backfillImages(articles.byStatus('published', 100), a => articles.save(a));
    db.prepare("UPDATE jobs SET status = 'done', finished_at = ?, result = ? WHERE id = ?").run(nowIso(), JSON.stringify(report), id);
  } catch (e) {
    db.prepare("UPDATE jobs SET status = 'failed', finished_at = ?, result = ? WHERE id = ?").run(nowIso(), JSON.stringify({error: String(e.message).slice(0, 500)}), id);
  }
}

async function post(key, {articleId = null, campaignId = null, channel, language, text}) {
  if (db.prepare('SELECT 1 FROM telegram_posts WHERE key = ?').get(key)) return;
  db.prepare("INSERT INTO telegram_posts (key, article_id, campaign_id, channel, language, status, attempted_at) VALUES (?, ?, ?, ?, ?, 'sending', ?)").run(key, articleId, campaignId, channel, language, nowIso());
  try {
    const messageId = await sendTelegram({token, channel, text});
    db.prepare("UPDATE telegram_posts SET status = 'sent', message_id = ? WHERE key = ?").run(messageId, key);
  } catch (e) {
    db.prepare('UPDATE telegram_posts SET status = ?, error = ? WHERE key = ?').run(e instanceof TelegramRejected ? 'rejected' : 'uncertain', String(e.message).slice(0, 300), key);
  }
  await new Promise(r => setTimeout(r, 1100));
}

async function deliverArticles() {
  const fresh = articles.byStatus('published', 100).filter(a => !a.demo && !a.archive && Date.now() - Date.parse(a.sitePublishedAt || a.collectedAt || 0) < 24 * 3600000);
  for (const a of fresh.reverse()) for (const language of ['ru', 'en']) for (const channel of channelsForArticle(connections, language, a)) {
    const hashtag = topics.find(t => t.id === a.category)?.hashtag?.[language] || '';
    await post(`article:${a.id}:${language}:${channel}`, {articleId: a.id, channel, language, text: formatArticlePost(a, {siteUrl, language, hashtag})});
  }
}

async function runCampaigns() {
  campaigns.tick();
  // Sponsored Telegram posts go out once, when the campaign becomes active.
  for (const c of campaigns.listAll('active').filter(c => c.placement === 'telegram')) {
    for (const language of c.languages) for (const topic of c.topics) {
      const channel = telegramURL(connections.telegram?.[language]?.[topic]);
      if (!channel || !telegramOn) continue;
      await post(`campaign:${c.id}:${language}:${channel}`, {campaignId: c.id, channel, language, text: formatAdPost({...c, clickUrl: new URL('/go/' + c.id, publicUrl || 'http://localhost').href}, language)});
    }
  }
}

const newsletterReady = !!(process.env.BREVO_API_KEY && validEmail(process.env.NEWSLETTER_FROM) && /^https:\/\//.test(process.env.NEWSLETTER_PUBLIC_URL || ''));
const subscriptions = new Subscriptions(dataDir, newsletterReady ? {send: brevoSender({apiKey: process.env.BREVO_API_KEY, fromEmail: process.env.NEWSLETTER_FROM}), baseUrl: process.env.NEWSLETTER_PUBLIC_URL} : {});

let busy = false;
async function cycle() {
  if (busy) return;
  busy = true;
  try {
    await runCampaigns();
    await runNewsroom();
    if (telegramOn) await deliverArticles();
    if (process.env.ATLAS_EMAIL_DELIVERY === '1') await subscriptions.digest(articles.byStatus('published', 100), siteUrl);
  } catch (e) { console.error('Worker cycle failed:', e.message); } finally { busy = false; }
}
console.log(`Worker started: newsroom every ${intervalMinutes} min, Telegram ${telegramOn ? 'on' : 'off'}`);
cycle();
setInterval(cycle, 60000);
