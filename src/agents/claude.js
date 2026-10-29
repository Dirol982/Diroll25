// Shared Claude API plumbing for the newsroom agents.
// The client is injectable so tests (and dry runs) never call the real API.
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.ATLAS_MODEL || 'claude-opus-5-5';
export const WEB_SEARCH = {type: 'web_search_20260209', name: 'web_search'};
export const WEB_FETCH = {type: 'web_fetch_20260209', name: 'web_fetch'};

export function createClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw Error('ANTHROPIC_API_KEY is not set; agents cannot run');
  return new Anthropic();
}

export class AgentRefusal extends Error {}

// Runs one agent turn. Server tools (web search/fetch) may pause the turn after
// their internal iteration limit; we resume up to maxContinuations times.
// When a client tool named `submitTool` is called, its input is the agent's answer.
export async function runAgent(client, options) {
  // Other providers (src/agents/gemini.js) bring their own runner with the same contract.
  if (client.runAgent) return client.runAgent(options);
  const {system, prompt, tools = [], submitTool, outputSchema, effort = 'medium', maxTokens = 16000, maxContinuations = 4} = options;
  const messages = [{role: 'user', content: prompt}];
  const retrieved = new Set();
  const usage = {input_tokens: 0, output_tokens: 0};
  for (let turn = 0; turn <= maxContinuations; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages,
      tools: tools.length ? tools : undefined,
      output_config: {effort, ...(outputSchema ? {format: {type: 'json_schema', schema: outputSchema}} : {})},
    });
    usage.input_tokens += response.usage?.input_tokens || 0;
    usage.output_tokens += response.usage?.output_tokens || 0;
    collectRetrievedUrls(response.content, retrieved);
    if (response.stop_reason === 'refusal') throw new AgentRefusal(response.stop_details?.explanation || 'Model declined the request');
    if (submitTool) {
      const call = response.content.find(b => b.type === 'tool_use' && b.name === submitTool);
      if (call) return {result: call.input, retrieved, usage};
    }
    if (response.stop_reason === 'pause_turn') {
      // Consecutive assistant messages are merged by the API, so the history stays append-only.
      messages.push({role: 'assistant', content: response.content});
      continue;
    }
    if (response.stop_reason === 'max_tokens') throw Error('Agent output was truncated');
    if (outputSchema) {
      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
      return {result: JSON.parse(text), retrieved, usage};
    }
    throw Error(`Agent finished without calling ${submitTool}`);
  }
  throw Error('Agent did not finish within the continuation limit');
}

// URLs that actually came back from web_search / web_fetch in this conversation.
// Verification only accepts sources from this set, so a model cannot cite a page it never saw.
export function collectRetrievedUrls(content, into = new Set()) {
  for (const block of content || []) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r.url) into.add(normalizeUrl(r.url));
    }
    if (block.type === 'web_fetch_tool_result' && block.content?.url) into.add(normalizeUrl(block.content.url));
  }
  return into;
}

export function normalizeUrl(value) {
  try {
    const u = new URL(value);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(key)) u.searchParams.delete(key);
    return u.href.replace(/\/$/, '');
  } catch { return String(value); }
}

// Rough registrable domain: good enough to tell bbc.co.uk from reuters.com.
export function publisherDomain(value) {
  try {
    const parts = new URL(value).hostname.replace(/^www\./, '').split('.');
    const secondLevel = ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'];
    return parts.length > 2 && secondLevel.includes(parts.at(-2)) ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
  } catch { return ''; }
}
