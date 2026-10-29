// Low-cost newsroom for free AI tiers: RSS feeds instead of web search.
//   1. Collect fresh headlines from established outlets (no AI).
//   2. One AI call groups headlines about the same event and ranks them.
//   3. Code keeps only events reported by at least two different outlets (real URLs we fetched).
//   4. One AI call per story writes the Russian and English copy from the outlets' own snippets.
import {runAgent, normalizeUrl, AgentRefusal} from './agents/claude.js';
import {rewriteStory} from './agents/rewrite.js';
import {buildArticle} from './pipeline.js';
import {fetchFeeds} from './feeds.js';
import {findImage} from './images.js';

const clusterSchema = {
  type: 'object',
  required: ['stories'],
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['topic', 'items', 'headline', 'importance', 'country'],
        properties: {
          topic: {type: 'string'},
          items: {type: 'array', items: {type: 'integer'}, description: 'Numbers of the headlines that report this same event'},
          headline: {type: 'string', description: 'Neutral English headline for the event'},
          importance: {type: 'integer', description: '1-5'},
          country: {type: 'string', description: 'ISO 3166-1 alpha-2 of the main country, or empty'},
        },
      },
    },
  },
};

const SYSTEM = `You are the news desk editor of ATLAS. You receive numbered headlines from many outlets, in English and Russian.
Group headlines that report the SAME specific event (same people, place, numbers), across outlets and languages.
Return only events covered by at least two different outlets, most significant first. Skip opinion, reviews, quizzes, live blogs, horoscopes and promotional items.
Never merge different events just because the topic is similar.`;

export async function runFeedPipeline({client, store, topics, feeds, now = new Date(), maxStories = 3, fetcher = fetch, imageFinder = findImage, log = console.log}) {
  const report = {mode: 'feeds', startedAt: now.toISOString(), published: [], held: [], rejected: [], errors: [], usage: {input_tokens: 0, output_tokens: 0}};
  const add = u => { if (u) { report.usage.input_tokens += u.input_tokens; report.usage.output_tokens += u.output_tokens; } };
  const sections = topics.filter(t => t.search !== false);
  const {items: all, report: feedReport} = await fetchFeeds(feeds.filter(f => sections.some(t => t.id === f.topic)), {fetcher, now});
  report.feeds = feedReport;
  const seen = await store.seen();
  const seenUrls = new Set(seen.map(s => s.url));
  // The newest 40 headlines per section keep the grouping prompt small and fast.
  const fresh = all.filter(i => !seenUrls.has(normalizeUrl(i.url))).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const items = sections.flatMap(t => fresh.filter(i => i.topic === t.id).slice(0, Number(process.env.ATLAS_HEADLINES_PER_SECTION || 40)));
  report.candidates = items.length;
  if (items.length < 2) return {...report, finishedAt: new Date().toISOString()};

  const listing = sections.map(t => {
    const lines = items.map((i, n) => ({i, n})).filter(({i}) => i.topic === t.id).map(({i, n}) => `${n}. [${i.outlet}] ${i.title}`);
    return lines.length ? `## ${t.id}\n${lines.join('\n')}` : '';
  }).filter(Boolean).join('\n\n');
  let clusters;
  try {
    const out = await runAgent(client, {system: SYSTEM, prompt: `Sections: ${sections.map(t => t.id).join(', ')}.\nReturn at most ${maxStories * 2} events.\n\n${listing}`, outputSchema: clusterSchema, effort: 'low'});
    add(out.usage);
    clusters = out.result.stories || [];
  } catch (e) {
    report.errors.push({stage: 'cluster', error: String(e.message).slice(0, 300)});
    return {...report, finishedAt: new Date().toISOString()};
  }

  for (const c of clusters) {
    if (report.published.length + report.held.length >= maxStories) break;
    const group = [...new Set(c.items)].map(n => items[n]).filter(Boolean);
    const outlets = new Set(group.map(i => i.domain));
    const topic = sections.find(t => t.id === c.topic) || sections.find(t => t.id === group[0]?.topic);
    if (outlets.size < 2 || !topic) {
      report.rejected.push({headline: c.headline, verdict: 'single-outlet', problems: ['fewer-than-two-independent-sources']});
      continue;
    }
    // Model grouping is a suggestion; the earliest report sets the time, and every item gets marked as seen.
    const earliest = group.map(i => i.publishedAt).sort()[0];
    const sources = [...new Map(group.map(i => [i.domain, {url: i.url, publisher: i.outlet, confirms: true}])).values()];
    const verification = {
      verdict: 'cross-source', decision: 'publish', problems: [], independentSources: outlets.size, publishedAt: earliest, notes: 'Reported by several outlets in their own feeds',
      confirmedFacts: group.map(i => `${i.outlet} (${i.lang.toUpperCase()}): ${i.title}${i.description ? ' — ' + i.description : ''}`),
      disputedFacts: [], sources,
    };
    const story = {headline: c.headline, sourceUrls: [sources[0].url], publishedAt: earliest, country: c.country, importance: c.importance};
    const mark = async decision => { for (const i of group) await store.markSeen({url: normalizeUrl(i.url), title: c.headline, category: topic.id, decision, at: now.toISOString()}); };
    try {
      const {article: copy, problems, usage} = await rewriteStory(client, {story, verification, topic});
      add(usage);
      const article = buildArticle({story, verification: {...verification, problems}, copy, topic, now, status: problems.length ? 'pending' : 'published'});
      const image = await imageFinder(article.imageQuery);
      if (image) article.image = image;
      article.imageSearchedAt = new Date().toISOString();
      await store.save(article);
      await mark(problems.length ? 'held' : 'published');
      (problems.length ? report.held : report.published).push({id: article.id, title: article.title.en, outlets: [...outlets]});
      log(`${problems.length ? 'Held' : 'Published'}: [${topic.id}] ${article.title.en}`);
    } catch (e) {
      report.errors.push({topic: topic.id, headline: c.headline, stage: e instanceof AgentRefusal ? 'refusal' : 'write', error: String(e.message).slice(0, 300)});
      // A quota error will hit every remaining story too; stop instead of burning the rest of the run.
      if (/429|quota/i.test(e.message)) break;
    }
  }
  report.finishedAt = new Date().toISOString();
  return report;
}
