// Agent 3: writes the bilingual article and Telegram posts from verified facts only.
import {runAgent} from './claude.js';

const languageBlock = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'lead', 'paragraphs', 'whyItMatters', 'whatNext', 'telegram'],
  properties: {
    title: {type: 'string', description: 'Up to 110 characters, factual'},
    lead: {type: 'string', description: 'One or two sentences summarising the news'},
    paragraphs: {type: 'array', items: {type: 'string'}, description: '3-5 short paragraphs of original text'},
    whyItMatters: {type: 'string'},
    whatNext: {type: 'string', description: 'Announced next steps or open questions; no speculation presented as fact'},
    telegram: {type: 'string', description: 'Telegram post body, 300-700 characters, plain text, no links, no hashtags'},
  },
};

const articleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ru', 'en'],
  properties: {ru: languageBlock, en: languageBlock},
};

const SYSTEM = `You are the bilingual writing desk of ATLAS. Write an original news article in Russian and in English.
Rules:
- Use only the verified facts you are given. Do not add numbers, names, quotes or causes that are not in them.
- Write in your own words; never copy sentences from sources. Attribute claims ("according to Reuters", "по данным Reuters").
- Neutral tone, no clickbait, no emojis. Russian must read as native Russian journalism, not a translation; English likewise.
- Dates and figures must match the facts exactly in both languages.`;

export async function rewriteStory(client, {story, verification, topic}) {
  const prompt = `Section: ${topic.name.en} / ${topic.name.ru}
Working headline: ${story.headline}
Verified facts:
${verification.confirmedFacts.map(f => '- ' + f).join('\n')}
${verification.disputedFacts.length ? 'Not confirmed (mention only as unconfirmed, or leave out):\n' + verification.disputedFacts.map(f => '- ' + f).join('\n') : ''}
Sources: ${verification.sources.map(s => `${s.publisher} (${s.url})`).join('; ')}
Publication time: ${verification.publishedAt}`;
  const {result, usage} = await runAgent(client, {system: SYSTEM, prompt, effort: 'medium', outputSchema: articleSchema});
  return {article: result, problems: checkCopy(result), usage};
}

export function checkCopy(copy) {
  const problems = [];
  for (const lang of ['ru', 'en']) {
    const c = copy?.[lang];
    if (!c) { problems.push(lang + ':missing'); continue; }
    if (!c.title?.trim() || c.title.length > 140) problems.push(lang + ':title');
    if (!c.lead?.trim()) problems.push(lang + ':lead');
    if (!Array.isArray(c.paragraphs) || c.paragraphs.length < 2) problems.push(lang + ':body');
    if (!c.telegram?.trim() || c.telegram.length > 900) problems.push(lang + ':telegram');
  }
  if (copy?.ru && !/[а-яё]/i.test(copy.ru.title + copy.ru.lead)) problems.push('ru:not-russian');
  return problems;
}
