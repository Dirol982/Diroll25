// ATLAS web server: public site, accounts and cabinet, advertising, payments, editor tools.
// Background work (agents, Telegram, campaign scheduling) runs in src/worker.js.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openDatabase, articleRepo, nowIso} from './db.js';
import {authService, publicUser} from './auth.js';
import {campaignService} from './ads.js';
import {paymentService, availableProviders} from './payments/index.js';
import {checkArticle} from '../editorial.js';
import {Subscriptions, brevoSender, validEmail} from '../subscriptions.js';
import {channelFor} from '../telegram.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dataDir = process.env.ATLAS_DATA_DIR || root + 'data';
const readJson = async path => JSON.parse(await readFile(root + path, 'utf8'));
const connections = await readJson('config/connections.json');
const {topics} = await readJson('config/topics.json');
const packages = await readJson('config/ad-packages.json');
const topicIds = topics.filter(t => t.search !== false).map(t => t.id);
const publicUrl = process.env.ATLAS_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
const secureCookies = publicUrl.startsWith('https://');
// The site this backend serves: links in Telegram posts and emails point here once it is live.
const siteUrl = process.env.ATLAS_PUBLIC_URL ? new URL('/a/', publicUrl).href : connections.siteUrl;

const db = openDatabase(process.env.ATLAS_DB || dataDir + '/atlas.db');
const articles = articleRepo(db);
const auth = authService(db);
const campaigns = campaignService(db, {packages, topicIds});
const payments = paymentService(db, {campaigns, publicUrl, currency: packages.currency});

// First start: bring over the already verified public snapshot.
if (!articles.count()) {
  try { for (const a of (await readJson('config/published.json')).articles) articles.save(a); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

const newsletterReady = !!(process.env.BREVO_API_KEY && validEmail(process.env.NEWSLETTER_FROM) && /^https:\/\//.test(process.env.NEWSLETTER_PUBLIC_URL || ''));
const subscriptions = new Subscriptions(dataDir, newsletterReady ? {send: brevoSender({apiKey: process.env.BREVO_API_KEY, fromEmail: process.env.NEWSLETTER_FROM}), baseUrl: process.env.NEWSLETTER_PUBLIC_URL} : {});

// ---- small HTTP helpers -------------------------------------------------------------
const securityHeaders = {'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY'};
const json = (res, status, data, headers = {}) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...securityHeaders, ...headers}); res.end(JSON.stringify(data)); };
const fail = (message, status = 400) => { throw Object.assign(Error(message), {status}); };
async function readBody(req, limit = 16000) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > limit) fail('Request too large', 413); }
  return raw;
}
async function readJsonBody(req, limit) { try { return JSON.parse((await readBody(req, limit)) || '{}'); } catch (e) { if (e.status) throw e; fail('Invalid JSON'); } }
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(([k, v]) => k && v));
const sessionCookie = (token, maxAge) => `atlas_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;

const limits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now(), entry = limits.get(key) || {start: now, count: 0};
  if (now - entry.start > windowMs) { entry.start = now; entry.count = 0; }
  if (++entry.count > max) fail('Too many attempts, please try later', 429);
  limits.set(key, entry);
  if (limits.size > 10000) for (const [k, v] of limits) if (now - v.start > windowMs) limits.delete(k);
}
const clientIp = req => (process.env.ATLAS_TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;

// State-changing requests must come from our own pages (cookie auth + origin check = CSRF protection).
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (origin) return origin === new URL(publicUrl).origin || origin === `http://${req.headers.host}`;
  return !req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site']);
}

const requireUser = ctx => ctx.user || fail('Please sign in', 401);
const requireRole = (ctx, ...roles) => { requireUser(ctx); if (!roles.includes(ctx.user.role)) fail('Not allowed for your account', 403); return ctx.user; };

// ---- static files -------------------------------------------------------------------
const staticFiles = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['public/style.css', 'text/css; charset=utf-8'],
  '/cabinet': ['public/cabinet.html', 'text/html; charset=utf-8'],
  '/cabinet.js': ['public/cabinet.js', 'text/javascript; charset=utf-8'],
  '/cabinet.css': ['public/cabinet.css', 'text/css; charset=utf-8'],
};
const images = ['space.jpg', 'landscape.jpg', 'travel.jpg', 'culture.jpg', 'nature.jpg', 'technology.jpg'];
const photos = {technology: 'technology.jpg', science: 'space.jpg', economy: 'travel.jpg', culture: 'culture.jpg', sport: 'nature.jpg', travel: 'nature.jpg'};
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Shareable article URL with Open Graph tags, so Telegram shows a proper preview card.
function articlePage(a, lang) {
  const title = a.title[lang] || a.title.en, description = a.body[lang] || a.body.en;
  const target = `/?lang=${lang}#article/${encodeURIComponent(a.id)}`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(title)} — ATLAS</title>
<meta name="description" content="${esc(description)}"><meta property="og:type" content="article"><meta property="og:site_name" content="ATLAS">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(a.image?.url || new URL('/images/' + (photos[a.category] || 'landscape.jpg'), publicUrl).href)}">
<meta property="og:url" content="${esc(new URL('/a/' + a.id + '?lang=' + lang, publicUrl).href)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}"></head><body><a href="${esc(target)}">${esc(title)}</a></body></html>`;
}

// ---- routes -------------------------------------------------------------------------
const routes = [];
const route = (method, pattern, handler, {csrf = true} = {}) => routes.push({method, pattern: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, csrf});

route('GET', '/api/config', ctx => ({
  editorEnabled: ['editor', 'admin'].includes(ctx.user?.role), staticPreview: false, connections, newsletterReady,
  user: publicUser(ctx.user), cabinetUrl: '/cabinet', ads: true,
}));
route('GET', '/api/articles', () => articles.byStatus('published', 300));
route('GET', '/api/topics', () => ({topics: topics.map(t => ({id: t.id, name: t.name, telegram: {ru: channelFor(connections, 'ru', t.id), en: channelFor(connections, 'en', t.id)}, suggested: {ru: '@' + t.telegram.ru.username, en: '@' + t.telegram.en.username}}))}));

// Accounts
route('POST', '/api/auth/register', async (ctx, req, res) => {
  rateLimit('register:' + clientIp(req), 10, 3600000);
  const body = await readJsonBody(req, 4000);
  const user = auth.register(body);
  const {token, maxAge} = auth.createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token, maxAge));
  return {user: publicUser(user)};
});
route('POST', '/api/auth/login', async (ctx, req, res) => {
  const body = await readJsonBody(req, 4000);
  rateLimit('login:' + clientIp(req), 20, 900000);
  rateLimit('login-email:' + String(body.email).toLowerCase(), 10, 900000);
  const user = auth.login(body.email, body.password);
  const {token, maxAge} = auth.createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token, maxAge));
  return {user: publicUser(user)};
});
route('POST', '/api/auth/logout', (ctx, req, res) => { auth.destroySession(ctx.token); res.setHeader('Set-Cookie', sessionCookie('', 0)); return {ok: true}; });
route('GET', '/api/me', ctx => ({user: publicUser(requireUser(ctx))}));
route('PATCH', '/api/me', async (ctx, req) => ({user: publicUser(auth.updateProfile(requireUser(ctx).id, await readJsonBody(req, 4000), topicIds))}));
route('POST', '/api/me/advertiser', ctx => { auth.becomeAdvertiser(requireUser(ctx).id); return {user: publicUser(auth.user(ctx.user.id))}; });
route('GET', '/api/me/bookmarks', ctx => db.prepare('SELECT article_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC').all(requireUser(ctx).id).map(r => articles.get(r.article_id)).filter(a => a?.status === 'published'));
route('PUT', '/api/me/bookmarks/:id', ctx => { requireUser(ctx); if (!articles.get(ctx.params.id)) fail('Not found', 404); db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, article_id, created_at) VALUES (?, ?, ?)').run(ctx.user.id, ctx.params.id, nowIso()); return {ok: true}; });
route('DELETE', '/api/me/bookmarks/:id', ctx => { db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND article_id = ?').run(requireUser(ctx).id, ctx.params.id); return {ok: true}; });

// Advertising
route('GET', '/api/ads/packages', () => ({...packages, providers: availableProviders(), topics: topicIds, eridRequired: process.env.ATLAS_REQUIRE_ERID === '1'}));
route('GET', '/api/ads', (ctx, req, res, url) => {
  const placement = url.searchParams.get('placement'), topic = url.searchParams.get('topic') || null, language = url.searchParams.get('lang') === 'en' ? 'en' : 'ru';
  if (!['feed', 'article'].includes(placement)) fail('Unknown placement');
  const ad = campaigns.pickAd({placement, topic, language});
  return {ad: ad && {id: ad.id, title: ad.title, text: ad.text, url: '/go/' + ad.id, advertiserName: ad.advertiserName, erid: ad.erid}};
});
route('GET', '/api/campaigns', ctx => campaigns.listForUser(requireRole(ctx, 'advertiser', 'admin').id));
route('POST', '/api/campaigns', async (ctx, req) => campaigns.create(requireRole(ctx, 'advertiser', 'admin').id, await readJsonBody(req)));
route('PATCH', '/api/campaigns/:id', async (ctx, req) => campaigns.update(requireRole(ctx, 'advertiser', 'admin').id, Number(ctx.params.id), await readJsonBody(req)));
route('POST', '/api/campaigns/:id/submit', ctx => campaigns.submit(requireRole(ctx, 'advertiser', 'admin').id, Number(ctx.params.id)));
route('POST', '/api/campaigns/:id/pay', async (ctx, req) => payments.start(requireRole(ctx, 'advertiser', 'admin').id, Number(ctx.params.id), (await readJsonBody(req, 1000)).provider));
route('GET', '/api/payments', ctx => payments.listForUser(requireUser(ctx).id));
route('POST', '/api/payments/nowpayments/ipn', async (ctx, req) => {
  const raw = await readBody(req, 20000);
  let body; try { body = JSON.parse(raw); } catch { fail('Invalid JSON'); }
  payments.handleNowpaymentsIpn(body, req.headers['x-nowpayments-sig']);
  return {ok: true};
}, {csrf: false});

// Editors: review queue (used by the newsroom page in app.js) and agent runs
route('GET', '/api/review', ctx => { requireRole(ctx, 'editor', 'admin'); return articles.byStatus('pending').map(a => ({...a, checks: checkArticle(a)})); });
route('POST', '/api/review/:id', async (ctx, req, res, url) => {
  requireRole(ctx, 'editor', 'admin');
  const a = articles.get(ctx.params.id) || fail('Not found', 404);
  const action = url.searchParams.get('action');
  if (a.status !== 'pending') fail('Article is no longer pending', 409);
  if (action === 'edit') {
    const b = await readJsonBody(req);
    if (!['titleRu', 'titleEn', 'bodyRu', 'bodyEn', 'importanceRu', 'importanceEn', 'nextRu', 'nextEn'].every(k => typeof b[k] === 'string' && b[k].trim() && b[k].length < 4000)) fail('Fill all editorial fields');
    articles.save({...a, title: {ru: b.titleRu.trim(), en: b.titleEn.trim()}, body: {ru: b.bodyRu.trim(), en: b.bodyEn.trim()}, importance: {ru: b.importanceRu.trim(), en: b.importanceEn.trim()}, next: {ru: b.nextRu.trim(), en: b.nextEn.trim()}, factsReviewed: b.factsReviewed === true, translationStatus: b.translationReviewed === true ? 'reviewed' : a.translationStatus, reviewedBy: ctx.user.id});
    return {ok: true};
  }
  if (action === 'publish') {
    const checks = checkArticle(a);
    if (!checks.canPublish) { const e = Error('Editorial checks require attention'); e.status = 422; e.extra = {checks}; throw e; }
    articles.save({...a, status: 'published', approvedAt: nowIso(), sitePublishedAt: nowIso(), approvedBy: ctx.user.id});
    return {ok: true};
  }
  if (action === 'reject') { articles.save({...a, status: 'rejected', rejectedBy: ctx.user.id}); return {ok: true}; }
  fail('Invalid action');
});
route('POST', '/api/newsroom/run', ctx => {
  requireRole(ctx, 'editor', 'admin');
  if (db.prepare("SELECT 1 FROM jobs WHERE kind = 'newsroom' AND status IN ('queued', 'running')").get()) fail('A newsroom run is already queued', 409);
  db.prepare("INSERT INTO jobs (kind, status, requested_by, created_at) VALUES ('newsroom', 'queued', ?, ?)").run(ctx.user.id, nowIso());
  return {ok: true};
});
route('GET', '/api/newsroom/jobs', ctx => { requireRole(ctx, 'editor', 'admin'); return db.prepare("SELECT * FROM jobs WHERE kind = 'newsroom' ORDER BY id DESC LIMIT 20").all().map(j => ({...j, result: j.result && JSON.parse(j.result)})); });

// Administrators
route('GET', '/api/admin/users', ctx => { requireRole(ctx, 'admin'); return db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 500').all().map(publicUser); });
route('PATCH', '/api/admin/users/:id', async (ctx, req) => {
  requireRole(ctx, 'admin');
  const id = Number(ctx.params.id);
  if (id === ctx.user.id) fail('You cannot change your own role');
  auth.setRole(id, (await readJsonBody(req, 1000)).role);
  return publicUser(auth.user(id));
});
route('GET', '/api/admin/campaigns', (ctx, req, res, url) => { requireRole(ctx, 'admin'); return campaigns.listAll(url.searchParams.get('status')); });
route('POST', '/api/admin/campaigns/:id/moderate', async (ctx, req) => { requireRole(ctx, 'admin'); const b = await readJsonBody(req, 2000); return campaigns.moderate(Number(ctx.params.id), b.decision, b.note); });
route('GET', '/api/admin/payments', ctx => { requireRole(ctx, 'admin'); return payments.listAll(); });
route('POST', '/api/admin/payments/:id/confirm', ctx => payments.confirmManually(ctx.params.id, requireRole(ctx, 'admin').id));
route('GET', '/api/admin/telegram', ctx => { requireRole(ctx, 'admin'); return db.prepare('SELECT * FROM telegram_posts ORDER BY attempted_at DESC LIMIT 200').all(); });

// Newsletter (unchanged behaviour from the original server)
route('POST', '/api/newsletter/subscribe', async (ctx, req) => {
  if (!newsletterReady) fail('Email subscriptions are not configured', 503);
  rateLimit('newsletter:' + clientIp(req), 10, 3600000);
  return subscriptions.subscribe(await readJsonBody(req, 4096));
});
route('GET', '/api/newsletter/confirm', async (ctx, req, res, url) => { if (!(await subscriptions.confirm(url.searchParams.get('token')))) fail('Invalid or expired link'); return {message: 'Subscription confirmed'}; });
route('GET', '/api/newsletter/unsubscribe', async (ctx, req, res, url) => { if (!(await subscriptions.unsubscribe(url.searchParams.get('token')))) fail('Invalid link'); return {message: 'Unsubscribed'}; });

// ---- request handling ---------------------------------------------------------------
export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method === 'GET' && path.startsWith('/go/')) {
      const target = campaigns.click(Number(path.slice(4)));
      res.writeHead(target ? 302 : 404, {Location: target || '/', 'Cache-Control': 'no-store', ...securityHeaders});
      return res.end();
    }
    if (req.method === 'GET' && path.startsWith('/a/')) {
      const a = articles.get(decodeURIComponent(path.slice(3)));
      if (!a || a.status !== 'published') { res.writeHead(302, {Location: '/'}); return res.end(); }
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', ...securityHeaders});
      return res.end(articlePage(a, url.searchParams.get('lang') === 'en' ? 'en' : 'ru'));
    }
    if (path.startsWith('/api/')) {
      for (const r of routes) {
        const match = r.method === req.method && path.match(r.pattern);
        if (!match) continue;
        if (r.csrf && req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, {error: 'Invalid origin'});
        const token = cookies(req).atlas_session;
        const ctx = {params: match.groups || {}, token, user: auth.userForToken(token)};
        const result = await r.handler(ctx, req, res, url);
        return json(res, 200, result ?? {ok: true});
      }
      return json(res, 404, {error: 'Not found'});
    }
    if (req.method === 'GET' && images.some(n => path === '/images/' + n)) {
      res.writeHead(200, {'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400'});
      return res.end(await readFile(root + 'public' + path));
    }
    const file = staticFiles[path];
    if (!file || req.method !== 'GET') return json(res, 404, {error: 'Not found'});
    res.writeHead(200, {'Content-Type': file[1], ...securityHeaders});
    res.end(await readFile(root + file[0]));
  } catch (e) {
    if (e.status) return json(res, e.status, {error: e.message, ...(e.extra || {})});
    console.error(e);
    json(res, 500, {error: 'Server error'});
  }
});

server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', function () { console.log('Portal ready on port ' + this.address().port); });
