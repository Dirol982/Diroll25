// Agent 1: finds fresh, significant stories for one topic.
import {runAgent, WEB_SEARCH} from './claude.js';

const storySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['stories'],
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'summary', 'keyFacts', 'sourceUrls', 'publishedAt', 'country', 'importance'],
        properties: {
          headline: {type: 'string', description: 'Factual headline in English, no clickbait'},
          summary: {type: 'string', description: 'Two or three sentences: who, what, when, where'},
          keyFacts: {type: 'array', items: {type: 'string'}, description: 'Atomic, checkable statements (numbers, names, dates)'},
          sourceUrls: {type: 'array', items: {type: 'string'}, description: 'Article URLs you actually opened or saw in search results, most authoritative first'},
          publishedAt: {type: 'string', description: 'ISO 8601 time of first publication, with timezone'},
          country: {type: 'string', description: 'ISO 3166-1 alpha-2 code of the main country, or an empty string for global stories'},
          importance: {type: 'integer', description: '1 = minor, 5 = top story of the day worldwide'},
        },
      },
    },
  },
};

const SYSTEM = `You are the search desk of ATLAS, a bilingual (Russian/English) news site.
Your job is to find real, recent, significant news, not to write articles.
Use web search. Prefer primary sources (official statements, regulators, companies, journals) and established news agencies.
Never invent stories, numbers or URLs. Skip rumours, opinion pieces, press-release fluff, paywalled-only reports and anything you could not see yourself.
When you are done, call submit_stories exactly once.`;

export async function searchTopic(client, {topic, now = new Date(), limit = 3, exclude = [], hoursBack = 24}) {
  const prompt = `Current time: ${now.toISOString()}.
Section: ${topic.name.en} — ${topic.brief}
Find up to ${limit} distinct, significant stories first published within the last ${hoursBack} hours.
Already covered (do not return these or near-duplicates):
${exclude.length ? exclude.map(t => '- ' + t).join('\n') : '- nothing yet'}
Return fewer stories rather than weak ones. An empty list is acceptable.`;
  const {result, retrieved, usage} = await runAgent(client, {
    system: SYSTEM,
    prompt,
    effort: 'medium',
    tools: [
      {...WEB_SEARCH, max_uses: 6},
      {name: 'submit_stories', description: 'Submit the stories you found. Call once, at the end.', input_schema: storySchema, strict: true},
    ],
    submitTool: 'submit_stories',
  });
  return {stories: (result.stories || []).slice(0, limit), retrieved, usage};
}
