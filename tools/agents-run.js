// Runs the agent newsroom once against the public snapshot (used by GitHub Actions).
// Without ANTHROPIC_API_KEY it exits cleanly so the rest of the Pages build still runs.
import {readFile} from 'node:fs/promises';
import {runPipeline} from '../src/pipeline.js';
import {openJsonStore} from '../src/json-store.js';
import {createClient} from '../src/agents/claude.js';

const root = new URL('../', import.meta.url);
if (!process.env.ANTHROPIC_API_KEY) { console.log('ANTHROPIC_API_KEY not set; agent newsroom skipped'); process.exit(0); }
const {topics} = JSON.parse(await readFile(new URL('config/topics.json', root), 'utf8'));
const store = await openJsonStore({publishedPath: new URL('config/published.json', root).pathname, seenPath: new URL('config/agent-seen.json', root).pathname});
const report = await runPipeline({
  client: createClient(),
  store,
  topics,
  perTopic: Number(process.env.ATLAS_STORIES_PER_TOPIC || 2),
  maxStories: Number(process.env.ATLAS_MAX_STORIES_PER_RUN || 6),
  // Pages has no review queue, so held stories are simply not published there.
  autoPublish: true,
});
console.log(JSON.stringify(report, null, 2));
