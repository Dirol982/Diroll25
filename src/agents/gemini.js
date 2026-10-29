// Gemini API adapter for the newsroom agents (free tier friendly).
// Implements the same runAgent contract as the Claude path: returns {result, retrieved, usage}.
// Web search uses Gemini's Google Search grounding; answers are requested as JSON in the text,
// because grounding cannot be relied on to combine with a forced response schema.
import {AgentRefusal, normalizeUrl, publisherDomain} from './claude.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Candidate models, best first: GEMINI_MODEL if set, then stable gemini-X.Y-flash (newest first),
// then flash-lite. The newest models often have no free-tier quota, so callers fall back down the list.
export async function resolveModels(key, fetcher = fetch) {
  const res = await fetcher(`${API}/models?pageSize=1000`, {headers: {'x-goog-api-key': key}, signal: AbortSignal.timeout(20000)});
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(`Gemini API rejected the key: ${body.error?.message || res.status}`);
  const usable = (body.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
  const version = name => Number((name.match(/^gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const newest = list => list.sort((a, b) => version(b) - version(a));
  const ordered = [
    ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
    ...newest(usable.filter(n => /^gemini-\d+(\.\d+)?-flash$/.test(n))),
    ...newest(usable.filter(n => /^gemini-\d+(\.\d+)?-flash-lite$/.test(n))),
  ];
  const models = [...new Set(ordered)];
  if (!models.length) throw Error('No Gemini Flash model is available to this key; set GEMINI_MODEL');
  return models;
}
export async function resolveModel(key, fetcher = fetch) { return (await resolveModels(key, fetcher))[0]; }

// Extracts the first JSON object from model text (it may wrap it in ``` fences or prose).
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1] : text;
  const start = source.indexOf('{'), end = source.lastIndexOf('}');
  if (start < 0 || end <= start) throw Error('Model did not return JSON');
  return JSON.parse(source.slice(start, end + 1));
}

export function groundedSources(candidate, into = new Set()) {
  for (const chunk of candidate?.groundingMetadata?.groundingChunks || []) {
    const web = chunk.web || {};
    // Grounding URIs are Google redirect links; the title carries the publisher's domain.
    if (web.uri && !/vertexaisearch\.cloud\.google\.com/.test(web.uri)) into.add(normalizeUrl(web.uri));
    const title = String(web.title || '').trim().toLowerCase();
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(title)) into.add('domain:' + publisherDomain('https://' + title));
    if (web.domain) into.add('domain:' + publisherDomain('https://' + web.domain));
  }
  return into;
}

export function createGeminiClient({key = process.env.GEMINI_API_KEY, fetcher = fetch, minIntervalMs = Number(process.env.GEMINI_MIN_INTERVAL_MS || 6000)} = {}) {
  if (!key) throw Error('GEMINI_API_KEY is not set; agents cannot run');
  let models, index = 0, lastCall = 0;
  const tried = [];

  async function call(model, body) {
    // Free-tier keys have small per-minute quotas: space calls out.
    const wait = lastCall + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetcher(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: {'x-goog-api-key': key, 'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
    return {res, data: await res.json().catch(() => ({}))};
  }

  async function generate(body) {
    models ||= await resolveModels(key, fetcher);
    let last;
    while (index < models.length) {
      const model = models[index];
      for (let attempt = 0; attempt < 3; attempt++) {
        const {res, data} = await call(model, body);
        if (res.ok) return data;
        last = `Gemini ${res.status} (${model}): ${data.error?.message || 'request failed'}`;
        if (res.status === 429) {
          // A daily or zero quota will not recover by waiting: move to the next model at once.
          const details = JSON.stringify(data.error?.details || []);
          if (/PerDay|limit: 0|"quotaValue":"0"/.test(details + (data.error?.message || '')) || attempt === 2) break;
          const hint = data.error?.details?.find(d => d.retryDelay)?.retryDelay;
          await sleep(Math.min(hint ? parseFloat(hint) * 1000 + 1000 : 20000, 65000));
          continue;
        }
        if ([500, 503].includes(res.status) && attempt < 2) { await sleep(15000 * (attempt + 1)); continue; }
        if (res.status === 404 || res.status === 400 && /not (found|supported)/i.test(last)) break;
        throw Error(last.slice(0, 400));
      }
      tried.push(model);
      index++;
    }
    throw Error(`${last} — tried: ${tried.join(', ')}`.slice(0, 500));
  }

  return {
    provider: 'gemini',
    checkLinks: true,
    get model() { return models?.[index]; },
    get triedModels() { return [...tried]; },
    async runAgent({system, prompt, tools = [], submitTool, outputSchema, maxTokens = 16000}) {
      const schema = outputSchema || tools.find(t => t.name === submitTool)?.input_schema;
      const search = tools.some(t => t.name === 'web_search' || t.name === 'web_fetch');
      const instructions = `${system}\n\n${search ? 'Use Google Search to find and check information. ' : ''}Reply with a single JSON object and nothing else. It must match this JSON Schema:\n${JSON.stringify(schema)}`;
      const data = await generate({
        systemInstruction: {parts: [{text: instructions}]},
        contents: [{role: 'user', parts: [{text: prompt}]}],
        ...(search ? {tools: [{google_search: {}}]} : {}),
        generationConfig: {maxOutputTokens: maxTokens, ...(search ? {} : {responseMimeType: 'application/json'})},
      });
      if (data.promptFeedback?.blockReason) throw new AgentRefusal('Gemini blocked the prompt: ' + data.promptFeedback.blockReason);
      const candidate = data.candidates?.[0];
      if (!candidate) throw Error('Gemini returned no answer');
      if (['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST'].includes(candidate.finishReason)) throw new AgentRefusal('Gemini stopped: ' + candidate.finishReason);
      if (candidate.finishReason === 'MAX_TOKENS') throw Error('Agent output was truncated');
      const text = (candidate.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join('');
      const usage = {input_tokens: data.usageMetadata?.promptTokenCount || 0, output_tokens: (data.usageMetadata?.candidatesTokenCount || 0) + (data.usageMetadata?.thoughtsTokenCount || 0)};
      return {result: extractJson(text), retrieved: groundedSources(candidate), usage};
    },
  };
}
