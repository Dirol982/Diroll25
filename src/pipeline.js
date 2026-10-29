// Newsroom pipeline: search -> independent verification -> bilingual rewrite -> publish or hold.
// Storage is abstracted so the same pipeline runs on the VPS (SQLite) and in GitHub Actions (JSON files).
import {createHash} from 'node:crypto';
import {searchTopic} from './agents/search.js';
import {verifyStory} from './agents/verify.js';
import {rewriteStory} from './agents/rewrite.js';
import {AgentRefusal, normalizeUrl} from './agents/claude.js';

const words = s => new Set(String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3));
export function similar(a, b) {
  const x = words(a), y = words(b);
  if (!x.size || !y.size) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / Math.min(x.size, y.size) >= 0.6;
}

export function storyId(url) { return 'agent-' + createHash('sha256').update(normalizeUrl(url)).digest('hex').slice(0, 20); }

export function buildArticle({story, verification, copy, topic, now, status}) {
  const primary = verification.sources.find(s => s.confirms) || verification.sources[0];
  const stamp = now.toISOString();
  const pick = key => ({ru: copy.ru[key], en: copy.en[key]});
  return {
    id: storyId(story.sourceUrls[0] || primary.url),
    category: topic.id,
    country: /^[A-Z]{2}$/.test(story.country || '') ? story.country : null,
    title: pick('title'),
    body: pick('lead'),
    content: pick('paragraphs'),
    importance: pick('whyItMatters'),
    next: pick('whatNext'),
    telegramText: pick('telegram'),
    status,
    demo: false,
    priority: Math.max(1, Math.min(5, story.importance || 3)),
    originalTitle: story.headline,
    source: {name: primary.publisher, url: primary.url, language: 'en'},
    sources: verification.sources.map(s => ({publisher: s.publisher, url: s.url, confirms: s.confirms})),
    publishedAt: verification.publishedAt || story.publishedAt,
    updatedAt: verification.publishedAt || story.publishedAt,
    collectedAt: stamp,
    ...(status === 'published' ? {sitePublishedAt: stamp} : {}),
    publicationMode: 'agents',
    translationStatus: 'ai-bilingual',
    factsReviewed: false,
    verification: {
      verdict: verification.verdict,
      independentSources: verification.independentSources,
      disputedFacts: verification.disputedFacts,
      problems: verification.problems,
      notes: verification.notes,
      checkedAt: stamp,
    },
  };
}

export async function runPipeline({client, store, topics, now = new Date(), perTopic = 2, maxStories = 6, autoPublish = true, log = console.log}) {
  const report = {startedAt: now.toISOString(), published: [], held: [], rejected: [], errors: [], usage: {input_tokens: 0, output_tokens: 0}};
  const addUsage = u => { if (u) { report.usage.input_tokens += u.input_tokens; report.usage.output_tokens += u.output_tokens; } };
  const seen = await store.seen();
  let processed = 0;
  for (const topic of topics.filter(t => t.search !== false)) {
    if (processed >= maxStories) break;
    let found;
    try {
      found = await searchTopic(client, {topic, now, limit: perTopic, exclude: seen.filter(s => s.category === topic.id).slice(-30).map(s => s.title)});
      addUsage(found.usage);
    } catch (e) {
      report.errors.push({topic: topic.id, stage: 'search', error: String(e.message).slice(0, 300)});
      continue;
    }
    for (const story of found.stories) {
      if (processed >= maxStories) break;
      const url = story.sourceUrls?.[0];
      if (!url || !/^https:\/\//.test(url)) continue;
      if (seen.some(s => s.url === normalizeUrl(url) || similar(s.title, story.headline))) continue;
      processed++;
      const mark = async decision => { const entry = {url: normalizeUrl(url), title: story.headline, category: topic.id, decision, at: now.toISOString()}; seen.push(entry); await store.markSeen(entry); };
      try {
        const verification = await verifyStory(client, story, {now});
        addUsage(verification.usage);
        if (verification.decision === 'reject') {
          report.rejected.push({headline: story.headline, verdict: verification.verdict, problems: verification.problems});
          await mark('rejected');
          continue;
        }
        const {article: copy, problems, usage} = await rewriteStory(client, {story, verification, topic});
        addUsage(usage);
        const publish = autoPublish && verification.decision === 'publish' && !problems.length;
        const article = buildArticle({story, verification: {...verification, problems: [...verification.problems, ...problems]}, copy, topic, now, status: publish ? 'published' : 'pending'});
        await store.save(article);
        await mark(publish ? 'published' : 'held');
        (publish ? report.published : report.held).push({id: article.id, title: article.title.en, problems: article.verification.problems});
        log(`${publish ? 'Published' : 'Held for review'}: [${topic.id}] ${article.title.en}`);
      } catch (e) {
        report.errors.push({topic: topic.id, headline: story.headline, stage: e instanceof AgentRefusal ? 'refusal' : 'verify-or-write', error: String(e.message).slice(0, 300)});
        await mark('error');
      }
    }
  }
  report.finishedAt = new Date().toISOString();
  return report;
}
