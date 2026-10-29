import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeminiClient, resolveModel, extractJson, groundedSources} from '../src/agents/gemini.js';
import {selectedProvider} from '../src/agents/provider.js';
import {assessVerification, linkReachable} from '../src/agents/verify.js';
import {searchTopic} from '../src/agents/search.js';

const models = {models: [
  {name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent']},
  {name: 'models/gemini-3.0-flash', supportedGenerationMethods: ['generateContent']},
  {name: 'models/gemini-3.0-flash-lite', supportedGenerationMethods: ['generateContent']},
  {name: 'models/gemini-3.0-pro', supportedGenerationMethods: ['generateContent']},
  {name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent']},
]};
const ok = body => ({ok: true, status: 200, json: async () => body});

test('provider selection prefers an explicit choice, then the free Gemini key', () => {
  assert.equal(selectedProvider({GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a'}), 'gemini');
  assert.equal(selectedProvider({GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a', ATLAS_AI_PROVIDER: 'claude'}), 'claude');
  assert.equal(selectedProvider({ANTHROPIC_API_KEY: 'a'}), 'claude');
  assert.equal(selectedProvider({}), null);
});

test('model discovery, JSON extraction and grounding domains', async () => {
  const prev = process.env.GEMINI_MODEL; delete process.env.GEMINI_MODEL;
  try { assert.equal(await resolveModel('k', async () => ok(models)), 'gemini-3.0-flash'); } finally { if (prev) process.env.GEMINI_MODEL = prev; }
  assert.deepEqual(extractJson('Here:\n```json\n{"a": [1]}\n```'), {a: [1]});
  assert.deepEqual(extractJson('{"stories": []}'), {stories: []});
  const seen = groundedSources({groundingMetadata: {groundingChunks: [{web: {uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/x', title: 'reuters.com'}}, {web: {uri: 'https://vertexaisearch.cloud.google.com/y', title: 'www.bbc.co.uk'}}]}});
  assert.ok(seen.has('domain:reuters.com') && seen.has('domain:bbc.co.uk'));
  const v = assessVerification({verdict: 'confirmed', confirmedFacts: ['x'], publishedAt: new Date().toISOString(), sources: [{url: 'https://www.reuters.com/a', publisher: 'Reuters', confirms: true}, {url: 'https://www.bbc.co.uk/b', publisher: 'BBC', confirms: true}, {url: 'https://made-up.example/c', publisher: 'X', confirms: true}]}, seen);
  assert.equal(v.independentSources, 2);
  assert.ok(v.problems.includes('cited-unseen-source'));
  assert.equal(await linkReachable('https://x.example/404', async () => ({ok: false, status: 404})), false);
  assert.equal(await linkReachable('https://x.example/bot', async () => ({ok: false, status: 403})), true);
});

test('search agent runs on Gemini with grounding and spaced, retried calls', async () => {
  const calls = [];
  const answer = {stories: [{headline: 'H', summary: 'S', keyFacts: ['f'], sourceUrls: ['https://www.reuters.com/a'], publishedAt: '2026-10-29T08:00:00Z', country: '', importance: 3}]};
  let first = true;
  const fetcher = async (url, init) => {
    if (url.endsWith('/models?pageSize=1000')) return ok(models);
    calls.push(JSON.parse(init.body));
    if (first) { first = false; return {ok: false, status: 429, json: async () => ({error: {message: 'quota', details: [{retryDelay: '0s'}]}})}; }
    return ok({candidates: [{finishReason: 'STOP', content: {parts: [{text: '```json\n' + JSON.stringify(answer) + '\n```'}]}, groundingMetadata: {groundingChunks: [{web: {uri: 'https://vertexaisearch.cloud.google.com/r', title: 'reuters.com'}}]}}], usageMetadata: {promptTokenCount: 10, candidatesTokenCount: 5}});
  };
  const client = createGeminiClient({key: 'k', fetcher, minIntervalMs: 0});
  const found = await searchTopic(client, {topic: {name: {en: 'Science'}, brief: 'space'}, limit: 2});
  assert.equal(found.stories[0].headline, 'H');
  assert.ok(found.retrieved.has('domain:reuters.com'));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].tools, [{google_search: {}}]);
  assert.match(calls[1].systemInstruction.parts[0].text, /JSON Schema/);
  assert.equal(client.model, 'gemini-3.0-flash');
});
