// Agent 2: independently re-checks a candidate story before anything is written.
import {runAgent, WEB_SEARCH, WEB_FETCH, normalizeUrl, publisherDomain} from './claude.js';

const verdictSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'confirmedFacts', 'disputedFacts', 'sources', 'publishedAt', 'notes'],
  properties: {
    verdict: {type: 'string', enum: ['confirmed', 'partially_confirmed', 'unconfirmed', 'false']},
    confirmedFacts: {type: 'array', items: {type: 'string'}, description: 'Facts confirmed by at least two independent sources, rewritten precisely'},
    disputedFacts: {type: 'array', items: {type: 'string'}, description: 'Facts that are contradicted or only in one source'},
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'publisher', 'confirms'],
        properties: {
          url: {type: 'string'},
          publisher: {type: 'string', description: 'Organisation name, e.g. Reuters, NASA, Bank of England'},
          confirms: {type: 'boolean', description: 'True if this page itself states the core facts'},
        },
      },
    },
    publishedAt: {type: 'string', description: 'Earliest confirmed publication time, ISO 8601 with timezone'},
    notes: {type: 'string', description: 'Short explanation for the editor'},
  },
};

const SYSTEM = `You are the verification desk of ATLAS. You did not find this story and you must not trust the person who did.
Check it independently: search for it yourself and open the pages you rely on.
A fact is confirmed only if at least two independent organisations report it (syndicated copies of one agency report count once).
Check the date: the event must be recent, not an old story resurfacing.
List only sources you actually saw in this session. Never guess a URL.
Be strict: when in doubt, choose "unconfirmed". Call submit_verification exactly once at the end.`;

export async function verifyStory(client, story, {now = new Date()} = {}) {
  const prompt = `Current time: ${now.toISOString()}.
Candidate story (from another desk, unverified):
Headline: ${story.headline}
Summary: ${story.summary}
Claimed facts:
${story.keyFacts.map(f => '- ' + f).join('\n')}
Leads (may be wrong): ${story.sourceUrls.join(' ')}
Claimed publication time: ${story.publishedAt}`;
  const {result, retrieved, usage} = await runAgent(client, {
    system: SYSTEM,
    prompt,
    effort: 'high',
    tools: [
      {...WEB_SEARCH, max_uses: 5},
      {...WEB_FETCH, max_uses: 5},
      {name: 'submit_verification', description: 'Submit your verdict. Call once, at the end.', input_schema: verdictSchema, strict: true},
    ],
    submitTool: 'submit_verification',
  });
  return {...assessVerification(result, retrieved, now), usage};
}

// Deterministic gate on top of the model's verdict.
export function assessVerification(result, retrieved, now = new Date(), maxAgeHours = 48) {
  const problems = [];
  const sources = (result.sources || []).filter(s => /^https:\/\//.test(s.url));
  const seen = sources.filter(s => retrieved.has(normalizeUrl(s.url)));
  if (seen.length < sources.length) problems.push('cited-unseen-source');
  const confirming = new Set(seen.filter(s => s.confirms).map(s => publisherDomain(s.url)).filter(Boolean));
  if (confirming.size < 2) problems.push('fewer-than-two-independent-sources');
  const time = Date.parse(result.publishedAt);
  if (!Number.isFinite(time)) problems.push('no-date');
  else if (time > now.getTime() + 15 * 60000) problems.push('future-date');
  else if (now.getTime() - time > maxAgeHours * 3600000) problems.push('stale');
  if (!result.confirmedFacts?.length) problems.push('no-confirmed-facts');
  let decision = 'reject';
  if (result.verdict === 'confirmed' && !problems.length) decision = 'publish';
  else if (['confirmed', 'partially_confirmed'].includes(result.verdict) && confirming.size >= 2 && !problems.includes('future-date') && !problems.includes('stale')) decision = 'review';
  return {decision, problems, verdict: result.verdict, confirmedFacts: result.confirmedFacts || [], disputedFacts: result.disputedFacts || [], sources: seen, independentSources: confirming.size, publishedAt: result.publishedAt, notes: result.notes || ''};
}
