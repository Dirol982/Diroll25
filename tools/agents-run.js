// Runs the agent newsroom once against the public snapshot (used by GitHub Actions).
// Without an AI key (GEMINI_API_KEY or ANTHROPIC_API_KEY) it exits cleanly so the rest of the Pages build still runs.
// Each run is summarised in config/agent-runs.json and in the Actions job summary.
import {readFile, writeFile, appendFile} from 'node:fs/promises';
import {runPipeline} from '../src/pipeline.js';
import {openJsonStore} from '../src/json-store.js';
import {createAgentClient, selectedProvider} from '../src/agents/provider.js';

const root = new URL('../', import.meta.url);
const runsPath = new URL('config/agent-runs.json', root);

async function record(entry) {
  let runs = [];
  try { runs = JSON.parse(await readFile(runsPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await writeFile(runsPath, JSON.stringify([entry, ...runs].slice(0, 30), null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [`### Agent newsroom: ${entry.status}`, '', `Published: ${entry.published?.length ?? 0} · Held: ${entry.held?.length ?? 0} · Rejected: ${entry.rejected?.length ?? 0} · Errors: ${entry.errors?.length ?? 0}`, ''];
    for (const p of entry.published || []) lines.push(`- ✅ ${p.title}`);
    for (const r of entry.rejected || []) lines.push(`- ✖ ${r.headline} (${r.verdict}; ${r.problems.join(', ')})`);
    for (const e of entry.errors || []) lines.push(`- ⚠ ${e.topic} / ${e.stage}: ${e.error}`);
    if (entry.message) lines.push(entry.message);
    await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  }
}

const provider = selectedProvider();
if (!provider) {
  await record({startedAt: new Date().toISOString(), status: 'skipped', message: 'No AI key (GEMINI_API_KEY or ANTHROPIC_API_KEY) is available to this workflow run'});
  console.log('No AI key set; agent newsroom skipped');
  process.exit(0);
}
const client = createAgentClient();
const {topics} = JSON.parse(await readFile(new URL('config/topics.json', root), 'utf8'));
const store = await openJsonStore({publishedPath: new URL('config/published.json', root).pathname, seenPath: new URL('config/agent-seen.json', root).pathname});
const report = await runPipeline({
  client,
  store,
  topics,
  perTopic: Number(process.env.ATLAS_STORIES_PER_TOPIC || 2),
  maxStories: Number(process.env.ATLAS_MAX_STORIES_PER_RUN || (provider === 'gemini' ? 4 : 6)),
  // Pages has no review queue, so held stories are simply not published there.
  autoPublish: true,
});
const searchFailures = report.errors.filter(e => e.stage === 'search').length;
const searchable = topics.filter(t => t.search !== false).length;
const status = searchFailures === searchable ? 'failed' : report.errors.length ? 'partial' : 'ok';
const diagnostics = provider === 'gemini' && status === 'failed' ? {modelErrors: client.modelErrors, probe: await client.probe().catch(e => String(e.message))} : undefined;
await record({...report, status, provider, model: provider === 'gemini' ? client.model : undefined, skippedModels: provider === 'gemini' ? client.triedModels : undefined, diagnostics});
console.log(JSON.stringify(report, null, 2));
// Every section failing means a configuration problem (key, model, quota): make the run visibly red.
if (status === 'failed') { console.error('Agent search failed for every section:', report.errors[0]?.error); process.exit(1); }
