import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {runPipeline, similar} from '../src/pipeline.js';
import {assessVerification} from '../src/agents/verify.js';
import {openJsonStore} from '../src/json-store.js';
import {publisherDomain} from '../src/agents/claude.js';
import {formatArticlePost, channelsForArticle, sendTelegram, TelegramRejected} from '../telegram.js';

const now = new Date('2026-10-29T12:00:00Z');
const topic = {id: 'science', name: {ru: 'Наука', en: 'Science'}, brief: 'Space'};
const story = {headline: 'Probe reaches Mars orbit', summary: 'A probe entered orbit.', keyFacts: ['Probe entered orbit on 28 October'], sourceUrls: ['https://www.esa.int/probe'], publishedAt: '2026-10-29T08:00:00Z', country: null, importance: 4};
const copyBlock = lang => ({title: lang === 'ru' ? 'Зонд вышел на орбиту Марса' : 'Probe reaches Mars orbit', lead: lang === 'ru' ? 'Зонд вышел на орбиту.' : 'The probe entered orbit.', paragraphs: ['One.', 'Two.'], whyItMatters: 'x', whatNext: 'y', telegram: lang === 'ru' ? 'Зонд вышел на орбиту Марса.' : 'The probe reached Mars orbit.'});
const searchResult = urls => ({type: 'web_search_tool_result', content: urls.map(url => ({type: 'web_search_result', url, title: 't'}))});

// Scripted stand-in for the Anthropic client: one response per agent call.
function fakeClient(verdict, sources) {
  const calls = [];
  return {calls, beta: {messages: {async create(params) {
    calls.push(params);
    const tool = params.tools?.find(t => t.name?.startsWith('submit_'))?.name;
    if (tool === 'submit_stories') return {stop_reason: 'tool_use', usage: {input_tokens: 1, output_tokens: 1}, content: [searchResult(story.sourceUrls), {type: 'tool_use', name: tool, input: {stories: [story]}}]};
    if (tool === 'submit_verification') return {stop_reason: 'tool_use', usage: {input_tokens: 1, output_tokens: 1}, content: [searchResult(sources.map(s => s.url)), {type: 'tool_use', name: tool, input: {verdict, confirmedFacts: ['Probe entered orbit on 28 October'], disputedFacts: [], sources, publishedAt: '2026-10-29T08:00:00Z', notes: ''}}]};
    return {stop_reason: 'end_turn', usage: {input_tokens: 1, output_tokens: 1}, content: [{type: 'text', text: JSON.stringify({ru: copyBlock('ru'), en: copyBlock('en')})}]};
  }}}};
}

async function withStore(fn) {
  const dir = await mkdtemp(tmpdir() + '/atlas-pipe-');
  try { await fn(await openJsonStore({publishedPath: dir + '/published.json', seenPath: dir + '/seen.json', now}), dir); } finally { await rm(dir, {recursive: true, force: true}); }
}

test('confirmed story with two independent sources is published in both languages', async () => {
  await withStore(async (store, dir) => {
    const client = fakeClient('confirmed', [{url: 'https://www.esa.int/probe', publisher: 'ESA', confirms: true}, {url: 'https://www.reuters.com/science/probe', publisher: 'Reuters', confirms: true}]);
    const report = await runPipeline({client, store, topics: [topic], now, log() {}});
    assert.equal(report.published.length, 1);
    const saved = JSON.parse(await readFile(dir + '/published.json', 'utf8')).articles[0];
    assert.equal(saved.title.ru, 'Зонд вышел на орбиту Марса');
    assert.equal(saved.verification.independentSources, 2);
    assert.equal(client.calls[0].model, 'claude-opus-5-5');
    assert.equal(client.calls[0].fallbacks, 'default');
    // A second run must not re-verify the same story.
    const again = await runPipeline({client, store, topics: [topic], now, log() {}});
    assert.equal(again.published.length + again.rejected.length + again.held.length, 0);
  });
});

test('single-source or unseen-source stories are not published', async () => {
  await withStore(async (store, dir) => {
    const report = await runPipeline({client: fakeClient('confirmed', [{url: 'https://www.esa.int/probe', publisher: 'ESA', confirms: true}, {url: 'https://esa.int/other', publisher: 'ESA', confirms: true}]), store, topics: [topic], now, log() {}});
    assert.equal(report.published.length, 0);
    assert.equal(report.rejected.length, 1);
    assert.equal(JSON.parse(await readFile(dir + '/seen.json', 'utf8'))[0].decision, 'rejected');
  });
  const v = assessVerification({verdict: 'confirmed', confirmedFacts: ['x'], sources: [{url: 'https://a.com/1', publisher: 'A', confirms: true}, {url: 'https://b.com/1', publisher: 'B', confirms: true}], publishedAt: now.toISOString()}, new Set(['https://a.com/1']), now);
  assert.ok(v.problems.includes('cited-unseen-source'));
  assert.equal(v.decision, 'reject');
  const stale = assessVerification({verdict: 'confirmed', confirmedFacts: ['x'], sources: [{url: 'https://a.com/1', publisher: 'A', confirms: true}, {url: 'https://b.com/1', publisher: 'B', confirms: true}], publishedAt: '2026-10-01T00:00:00Z'}, new Set(['https://a.com/1', 'https://b.com/1']), now);
  assert.equal(stale.decision, 'reject');
});

test('helpers: domains, duplicates, Telegram formatting and channel routing', async () => {
  assert.equal(publisherDomain('https://news.bbc.co.uk/x'), 'bbc.co.uk');
  assert.equal(publisherDomain('https://www.reuters.com/x'), 'reuters.com');
  assert.ok(similar('Probe reaches Mars orbit today', 'Mars probe reaches orbit'));
  assert.ok(!similar('Central bank raises rates', 'Probe reaches Mars orbit'));
  const article = {id: 'agent-1', category: 'science', priority: 5, title: {ru: 'A <b>', en: 'A'}, body: {ru: 'B', en: 'B'}, telegramText: {ru: 'Текст', en: 'Text'}, source: {name: 'ESA', url: 'https://esa.int'}, sources: [{publisher: 'ESA', url: 'https://esa.int/p'}]};
  const post = formatArticlePost(article, {siteUrl: 'https://dirol982.github.io/Diroll25/', language: 'ru', hashtag: '#наука'});
  assert.match(post, /<b>A &lt;b&gt;<\/b>/);
  assert.match(post, /#article\/agent-1/);
  assert.match(post, /#наука$/);
  const connections = {telegram: {ru: {science: 'https://t.me/atlas_context_science_ru', main: 'https://t.me/atlas_context_ru'}}};
  assert.deepEqual(channelsForArticle(connections, 'ru', article), ['https://t.me/atlas_context_science_ru', 'https://t.me/atlas_context_ru']);
  assert.deepEqual(channelsForArticle(connections, 'ru', {...article, priority: 2}), ['https://t.me/atlas_context_science_ru']);
  assert.deepEqual(channelsForArticle(connections, 'en', article), []);
  const fetcher = async (url, init) => ({json: async () => JSON.parse(init.body).parse_mode === 'HTML' ? {ok: true, result: {message_id: 7}} : {ok: false}});
  assert.equal(await sendTelegram({token: 't', channel: 'https://t.me/atlas_context_ru', text: 'x', fetcher}), 7);
  await assert.rejects(sendTelegram({token: 't', channel: 'https://t.me/atlas_context_ru', text: 'x', fetcher: async () => ({json: async () => ({ok: false, error_code: 400})})}), TelegramRejected);
});
