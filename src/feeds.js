// Minimal RSS 2.0 / Atom reader (no dependencies). Returns plain items with the outlet's domain,
// so "two independent outlets" can be checked in code against URLs we fetched ourselves.
import {publisherDomain, normalizeUrl} from './agents/claude.js';

const entities = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};
export function plainText(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e.toLowerCase()] ?? m)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const tag = (xml, names) => {
  for (const name of names) {
    const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
    if (m) return m[1];
  }
  return '';
};

export function parseFeed(xml, feed) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map(block => {
    let link = plainText(tag(block, ['link']));
    if (!/^https?:\/\//.test(link)) {
      const href = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || block.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = href ? href[1].replace(/&amp;/g, '&') : plainText(tag(block, ['guid']));
    }
    const date = plainText(tag(block, ['pubDate', 'published', 'updated', 'dc:date']));
    const time = Date.parse(date);
    return {
      title: plainText(tag(block, ['title'])).slice(0, 300),
      description: plainText(tag(block, ['description', 'summary', 'content'])).slice(0, 600),
      url: link.trim(),
      publishedAt: Number.isFinite(time) ? new Date(time).toISOString() : null,
      outlet: feed.name,
      domain: publisherDomain(link),
      lang: feed.lang,
      topic: feed.topic,
    };
  }).filter(i => i.title && /^https:\/\//.test(i.url) && i.publishedAt);
}

export async function fetchFeeds(feeds, {fetcher = fetch, now = new Date(), hoursBack = 24} = {}) {
  const report = new Array(feeds.length);
  const results = await Promise.all(feeds.map(async (feed, index) => {
    try {
      const res = await fetcher(feed.url, {headers: {'User-Agent': 'Mozilla/5.0 (compatible; ATLAS news reader)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml'}, signal: AbortSignal.timeout(20000)});
      if (!res.ok) throw Error('HTTP ' + res.status);
      const items = parseFeed(await res.text(), feed);
      report[index] = {feed: feed.name + ' / ' + feed.topic, ok: true, items: items.length};
      return items;
    } catch (e) {
      report[index] = {feed: feed.name + ' / ' + feed.topic, ok: false, error: String(e.message).slice(0, 120)};
      return [];
    }
  }));
  const fresh = results.flat().filter(i => {
    const age = now - Date.parse(i.publishedAt);
    return age > -15 * 60000 && age < hoursBack * 3600000;
  });
  // One item per URL.
  const byUrl = new Map();
  for (const i of fresh) byUrl.set(normalizeUrl(i.url), i);
  return {items: [...byUrl.values()], report};
}
