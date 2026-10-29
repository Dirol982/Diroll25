// Advertiser campaigns. Lifecycle:
//   draft -> moderation -> awaiting_payment -> scheduled -> active -> completed
//                       \-> rejected (with a note; the advertiser can edit and resubmit)
// Ads are reviewed before payment, so nobody pays for an ad that will be refused.
import {nowIso} from './db.js';

export const CAMPAIGN_FIELDS = ['name', 'placement', 'topics', 'languages', 'title', 'text', 'clickUrl', 'advertiserName', 'erid', 'startDate', 'days'];

const row = c => c && ({
  id: c.id, userId: c.user_id, name: c.name, placement: c.placement, topics: JSON.parse(c.topics), languages: JSON.parse(c.languages),
  title: c.title, text: c.text, clickUrl: c.click_url, advertiserName: c.advertiser_name, erid: c.erid, startDate: c.start_date, days: c.days,
  priceCents: c.price_cents, status: c.status, moderationNote: c.moderation_note, startsAt: c.starts_at, endsAt: c.ends_at,
  impressions: c.impressions, clicks: c.clicks, createdAt: c.created_at, updatedAt: c.updated_at,
});

const fail = (message, status = 400) => { throw Object.assign(Error(message), {status}); };

export function priceFor(packages, {placement, days, topics, languages}) {
  const p = packages.placements[placement];
  if (!p) fail('Unknown placement');
  return p.unit === 'channel' ? p.priceCents * topics.length * languages.length : p.priceCents * days;
}

export function validateCampaign(input, {packages, topicIds}) {
  const c = {};
  c.name = String(input.name || '').trim().slice(0, 100) || fail('Campaign name is required');
  c.placement = packages.placements[input.placement] ? input.placement : fail('Choose a placement');
  c.topics = Array.isArray(input.topics) ? [...new Set(input.topics)].filter(t => topicIds.includes(t)) : [];
  if (!c.topics.length) fail('Choose at least one section');
  c.languages = Array.isArray(input.languages) ? [...new Set(input.languages)].filter(l => ['ru', 'en'].includes(l)) : [];
  if (!c.languages.length) fail('Choose at least one language');
  c.title = String(input.title || '').trim();
  if (!c.title || c.title.length > 90) fail('Ad title: 1-90 characters');
  c.text = String(input.text || '').trim();
  if (!c.text || c.text.length > 400) fail('Ad text: 1-400 characters');
  try { const u = new URL(input.clickUrl); if (u.protocol !== 'https:' || u.username || u.password) throw 0; c.clickUrl = u.href; } catch { fail('Link must be an https:// address'); }
  c.advertiserName = String(input.advertiserName || '').trim().slice(0, 150) || fail('Advertiser name is required (shown in the ad label)');
  c.erid = String(input.erid || '').trim().slice(0, 64);
  if (c.erid && !/^[A-Za-z0-9]+$/.test(c.erid)) fail('erid may contain only letters and digits');
  if (c.languages.includes('ru') && !c.erid && process.env.ATLAS_REQUIRE_ERID === '1') fail('Russian-language ads need an erid token from an ad data operator (ОРД)');
  c.startDate = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate || '') && Number.isFinite(Date.parse(input.startDate)) ? input.startDate : fail('Start date is required');
  const placement = packages.placements[c.placement];
  c.days = placement.unit === 'channel' ? 1 : Number(input.days);
  if (!Number.isInteger(c.days) || c.days < packages.minDays || c.days > packages.maxDays) fail(`Duration: ${packages.minDays}-${packages.maxDays} days`);
  c.priceCents = priceFor(packages, c);
  return c;
}

export function campaignService(db, {packages, topicIds}) {
  const get = id => row(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id));
  const setStatus = (id, status, extra = {}) => {
    const sets = ['status = ?', 'updated_at = ?'], values = [status, nowIso()];
    for (const [k, v] of Object.entries(extra)) { sets.push(`${k} = ?`); values.push(v); }
    db.prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
    return get(id);
  };
  return {
    get,
    listForUser(userId) { return db.prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY id DESC').all(userId).map(row); },
    listAll(status) { return (status ? db.prepare('SELECT * FROM campaigns WHERE status = ? ORDER BY id DESC').all(status) : db.prepare('SELECT * FROM campaigns ORDER BY id DESC LIMIT 500').all()).map(row); },
    create(userId, input) {
      const c = validateCampaign(input, {packages, topicIds}), t = nowIso();
      const info = db.prepare(`INSERT INTO campaigns (user_id, name, placement, topics, languages, title, text, click_url, advertiser_name, erid, start_date, days, price_cents, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`).run(userId, c.name, c.placement, JSON.stringify(c.topics), JSON.stringify(c.languages), c.title, c.text, c.clickUrl, c.advertiserName, c.erid, c.startDate, c.days, c.priceCents, t, t);
      return get(Number(info.lastInsertRowid));
    },
    update(userId, id, input) {
      const old = get(id);
      if (!old || old.userId !== userId) fail('Not found', 404);
      if (!['draft', 'rejected'].includes(old.status)) fail('Only drafts and rejected campaigns can be edited', 409);
      const c = validateCampaign({...old, ...input}, {packages, topicIds});
      db.prepare(`UPDATE campaigns SET name = ?, placement = ?, topics = ?, languages = ?, title = ?, text = ?, click_url = ?, advertiser_name = ?, erid = ?, start_date = ?, days = ?, price_cents = ?, status = 'draft', updated_at = ? WHERE id = ?`)
        .run(c.name, c.placement, JSON.stringify(c.topics), JSON.stringify(c.languages), c.title, c.text, c.clickUrl, c.advertiserName, c.erid, c.startDate, c.days, c.priceCents, nowIso(), id);
      return get(id);
    },
    submit(userId, id) {
      const c = get(id);
      if (!c || c.userId !== userId) fail('Not found', 404);
      if (!['draft', 'rejected'].includes(c.status)) fail('Campaign was already submitted', 409);
      return setStatus(id, 'moderation', {moderation_note: ''});
    },
    moderate(id, decision, note = '') {
      const c = get(id);
      if (!c) fail('Not found', 404);
      if (c.status !== 'moderation') fail('Campaign is not awaiting moderation', 409);
      if (decision === 'approve') return setStatus(id, 'awaiting_payment', {moderation_note: String(note).slice(0, 500)});
      if (decision === 'reject') return setStatus(id, 'rejected', {moderation_note: String(note).slice(0, 500) || 'Rejected by the editor'});
      fail('Decision must be approve or reject');
    },
    // Called exactly once per campaign when its payment is confirmed.
    markPaid(id, paidAt = new Date()) {
      const c = get(id);
      if (!c || c.status !== 'awaiting_payment') return c;
      const start = new Date(Math.max(Date.parse(c.startDate + 'T00:00:00Z'), paidAt.getTime()));
      const end = new Date(start.getTime() + c.days * 86400000);
      return setStatus(id, 'scheduled', {starts_at: start.toISOString(), ends_at: end.toISOString()});
    },
    // Moves campaigns along their run window. Returns campaigns that just became active.
    tick(now = new Date()) {
      const t = now.toISOString();
      const started = db.prepare("SELECT id FROM campaigns WHERE status = 'scheduled' AND starts_at <= ?").all(t).map(r => setStatus(r.id, 'active'));
      for (const r of db.prepare("SELECT id FROM campaigns WHERE status = 'active' AND ends_at <= ?").all(t)) setStatus(r.id, 'completed');
      return started;
    },
    pickAd({placement, topic, language}) {
      const candidates = db.prepare("SELECT * FROM campaigns WHERE status = 'active' AND placement = ?").all(placement).map(row)
        .filter(c => c.languages.includes(language) && (!topic || c.topics.includes(topic)));
      if (!candidates.length) return null;
      const ad = candidates[Math.floor(Math.random() * candidates.length)];
      db.prepare('UPDATE campaigns SET impressions = impressions + 1 WHERE id = ?').run(ad.id);
      return ad;
    },
    click(id) {
      const c = get(id);
      if (!c || !['active', 'completed'].includes(c.status)) return null;
      db.prepare('UPDATE campaigns SET clicks = clicks + 1 WHERE id = ?').run(id);
      return c.clickUrl;
    },
  };
}
