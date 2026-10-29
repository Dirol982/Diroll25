// Chooses the AI provider for the newsroom agents.
//   ATLAS_AI_PROVIDER=claude|gemini   explicit choice
//   otherwise: Gemini when GEMINI_API_KEY is set (free tier), else Claude.
import {createClient as createClaudeClient} from './claude.js';
import {createGeminiClient} from './gemini.js';

export function selectedProvider(env = process.env) {
  const explicit = String(env.ATLAS_AI_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'claude' || explicit === 'gemini') return explicit;
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.ANTHROPIC_API_KEY) return 'claude';
  return null;
}

export function createAgentClient(env = process.env) {
  const provider = selectedProvider(env);
  if (provider === 'gemini') return createGeminiClient({key: env.GEMINI_API_KEY});
  if (provider === 'claude') return Object.assign(createClaudeClient(), {provider: 'claude'});
  throw Error('No AI key: set GEMINI_API_KEY or ANTHROPIC_API_KEY');
}
