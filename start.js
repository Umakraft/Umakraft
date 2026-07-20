/**
 * start.js — Bootstrap entry point
 *
 * Calls loadConfig() to read plain-text secrets (DISCORD_TOKEN, IDs, etc.)
 * from process.env (Replit Secrets) before any other module is imported,
 * so that config.js sees them when it evaluates.
 */
import 'dotenv/config';
import { loadOpenAiKey, loadConfig } from './core/tokenLoader.js';

// Load plain-text config values (Application ID, Server ID, Circle ID, UmaFantracking API)
// before anything else so they are in process.env when config.js evaluates them.
loadConfig();

if (!process.env.OPENROUTER_API_KEY) {
  try {
    await loadOpenAiKey();
  } catch (err) {
    console.warn('[Bootstrap] OpenAI key unavailable — image classification disabled:', err.message);
  }
}

// Token is now in process.env.DISCORD_TOKEN — safe to load the rest of the app
await import('./index.js');
