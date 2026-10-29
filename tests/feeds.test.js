import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {parseFeed, fetchFeeds} from '../src/feeds.js';
import {runFeedPipeline} from '../src/feed-pipeline.js';
import {openJsonStore} from '../src/json-store.js';

const now = new Date('2026-10-29T12:00:00Z');
const rss = (items) => `<?xml version="1.0"?><rss><channel><title>X</title>${items.map(i => `<item><title><![CDATA[${i.t}]]></title><link>${i.u}</link><description>&lt;p&gt;${i.d || ''}&lt;/p&gt;</description><pubDate>${i.p || 'Thu, 29 Oct 2026 10:00:00 GMT'}</pubDate></item>`).join('')}</channel></rss>`;
const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Атом &amp; новость</title><link rel="alternate" href="https://habr.com/ru/news/1/"/><updated>2026-10-29T09:00:00+03:00</updated><summary>Кратко</summary></entry></feed>`;

test('RSS and Atom parsing, freshness and failed feeds', async () => {
  const items = parseFeed(rss([{t: 'Probe reaches Mars', u: 'https://www.bbc.co.uk/news/1', d: 'ESA <b>said</b>'}]), {name: 'BBC', lang: 'en', topic: 'science'});
  assert.equal(items[0].title, 'Probe reaches Mars');
  assert.equal(items[0].description, 'ESA said');
  assert.equal(items[0].domain, 'bbc.co.uk');
  const a = parseFeed(atom, {name: 'Хабр', lang: 'ru', topic: 'technology'});
  assert.equal(a[0].title, 'Атом & новость');
  assert.equal(a[0].url, 'https://habr.com/ru/news/1/');
  assert.equal(a[0].publishedAt, '2026-10-29T06:00:00.000Z');
  const fetcher = async url => url.includes('bad') ? {ok: false, status: 403} : {ok: true, text: async () => rss([{t: 'Fresh', u: 'https://a.example/1'}, {t: 'Old', u: 'https://a.example/2', p: 'Mon, 01 Jan 2026 10:00:00 GMT'}])};
  const {items: fresh, report} = await fetchFeeds([{name: 'A', url: 'https://a.example/rss', lang: 'en', topic: 'science'}, {name: 'B', url: 'https://bad.example/rss', lang: 'en', topic: 'science'}], {fetcher, now});
  assert.deepEqual(fresh.map(i => i.title), ['Fresh']);
  assert.deepEqual(report.map(r => r.ok), [true, false]);
});

test('feed newsroom publishes only events reported by two different outlets', async () => {
  const dir = await mkdtemp(tmpdir() + '/atlas-feeds-');
  try {
    const store = await openJsonStore({publishedPath: dir + '/published.json', seenPath: dir + '/seen.json', now});
    const feeds = [
      {name: 'BBC', lang: 'en', topic: 'science', url: 'https://bbc.example/rss'},
      {name: 'Guardian', lang: 'en', topic: 'science', url: 'https://guardian.example/rss'},
      {name: 'N + 1', lang: 'ru', topic: 'science', url: 'https://nplus1.example/rss'},
    ];
    const bodies = {
      'https://bbc.example/rss': rss([{t: 'Probe reaches Mars orbit', u: 'https://www.bbc.co.uk/news/mars'}, {t: 'Bee study', u: 'https://www.bbc.co.uk/news/bees'}]),
      'https://guardian.example/rss': rss([{t: 'European probe enters orbit around Mars', u: 'https://www.theguardian.com/science/mars'}]),
      'https://nplus1.example/rss': rss([{t: 'Зонд вышел на орбиту Марса', u: 'https://nplus1.ru/news/mars'}]),
    };
    const prompts = [];
    const copy = lang => ({title: lang === 'ru' ? 'Зонд вышел на орбиту Марса' : 'Probe enters Mars orbit', lead: lang === 'ru' ? 'Зонд на орбите.' : 'Probe in orbit.', paragraphs: ['a', 'b'], whyItMatters: 'w', whatNext: 'n', telegram: lang === 'ru' ? 'Пост' : 'Post'});
    const client = {async runAgent({prompt, outputSchema}) {
      prompts.push(prompt);
      if (outputSchema.properties.stories) {
        const n = t => Number(prompt.match(new RegExp(`(\\d+)\\. \\[[^\\]]+\\] ${t}`))[1]);
        return {result: {stories: [
          {topic: 'science', items: [n('Probe reaches Mars orbit'), n('European probe enters orbit around Mars'), n('Зонд вышел на орбиту Марса')], headline: 'Probe enters Mars orbit', importance: 4, country: ''},
          {topic: 'science', items: [n('Bee study')], headline: 'Bee study', importance: 2, country: ''},
        ]}, usage: {input_tokens: 5, output_tokens: 5}};
      }
      return {result: {ru: copy('ru'), en: copy('en')}, usage: {input_tokens: 5, output_tokens: 5}};
    }};
    const report = await runFeedPipeline({client, store, feeds, topics: [{id: 'science', name: {ru: 'Наука', en: 'Science'}}], now, fetcher: async url => ({ok: true, text: async () => bodies[url]}), log() {}});
    assert.equal(report.published.length, 1, JSON.stringify(report));
    assert.equal(report.rejected[0].verdict, 'single-outlet');
    assert.equal(prompts.length, 2);
    const article = JSON.parse(await readFile(dir + '/published.json', 'utf8')).articles[0];
    assert.equal(article.verification.verdict, 'cross-source');
    assert.equal(article.verification.independentSources, 3);
    assert.equal(article.sources.length, 3);
    assert.equal(article.priority, 4);
    // Everything in the published group is remembered, so the next run does not repeat it.
    const again = await runFeedPipeline({client, store, feeds, topics: [{id: 'science', name: {ru: 'Наука', en: 'Science'}}], now, fetcher: async url => ({ok: true, text: async () => bodies[url]}), log() {}});
    assert.equal(again.published.length, 0);
  } finally { await rm(dir, {recursive: true, force: true}); }
});
