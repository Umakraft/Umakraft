/**
 * Umakraft UmaMoe — Discord HTTP Interactions Server
 *
 * Discord sends POST /interactions for every slash command and autocomplete.
 * This server verifies the Ed25519 signature, routes to the interaction handler,
 * and handles deferred replies via the Discord webhook follow-up API.
 */

'use strict';

const express = require('express');
const crypto = require('node:crypto');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

const createDiscordInteraction = require('./Distribution/Interaction/Discord/interaction');
const { registerCommands } = require('./Distribution/Interaction/Discord/commands/register-commands');
const retriever = require('./Distribution/Retriever/retriever');
const delivery = require('./Distribution/Delivery/delivery');

// ── Config ────────────────────────────────────────────────────────────────────
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const APP_ID     = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN  = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID   = process.env.DISCORD_GUILD_ID;
const PORT       = parseInt(process.env.PORT || '3000', 10);

// ── Signature verification ────────────────────────────────────────────────────
// Discord signs every request with Ed25519. Reject anything that doesn't verify.
let _publicKeyObj = null;
function getPublicKey() {
  if (!_publicKeyObj) {
    if (!PUBLIC_KEY) throw new Error('DISCORD_PUBLIC_KEY is not set');
    const ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
    const der = Buffer.concat([ED25519_PREFIX, Buffer.from(PUBLIC_KEY, 'hex')]);
    _publicKeyObj = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
  }
  return _publicKeyObj;
}

function verifySignature(rawBody, signature, timestamp) {
  try {
    const msg = Buffer.concat([Buffer.from(timestamp), rawBody]);
    const sig = Buffer.from(signature, 'hex');
    return crypto.verify(null, msg, getPublicKey(), sig);
  } catch {
    return false;
  }
}

// ── Interaction option adapter ────────────────────────────────────────────────
// Wraps Discord's flat options array so commands can call .getString(), etc.
function createOptionsAdapter(options = [], resolved = {}) {
  const map = new Map(options.map((o) => [o.name, o]));

  return {
    getString:  (name) => map.get(name)?.value ?? null,
    getInteger: (name) => map.get(name)?.value ?? null,
    getBoolean: (name) => map.get(name)?.value ?? null,
    getFocused: ()     => options.find((o) => o.focused)?.value ?? null,
    getUser: (name) => {
      const userId = map.get(name)?.value;
      if (!userId) return null;
      const user = resolved?.users?.[userId] || { id: userId };
      return { id: user.id, username: user.username, tag: user.username ? `${user.username}#${user.discriminator || '0'}` : userId };
    },
  };
}

// ── Interaction adapter ───────────────────────────────────────────────────────
// Wraps the raw Discord payload into the object shape commands expect.
function createInteractionAdapter(body, resolveResponse) {
  const token   = body.token;
  const appId   = body.application_id || APP_ID;
  const webhookUrl = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`;

  const rawUser = body.member?.user || body.user || {};
  const options = createOptionsAdapter(body.data?.options || [], body.data?.resolved || {});

  let _resolved = false;

  function resolve(payload) {
    if (!_resolved) {
      _resolved = true;
      resolveResponse(payload);
    }
  }

  async function editReplyViaWebhook(data) {
    const payload = buildMessagePayload(data);
    const res = await fetch(webhookUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${BOT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[server] editReply webhook failed ${res.status}:`, text);
    }
  }

  return {
    commandName: body.data?.name,
    token,
    user: {
      id:       rawUser.id,
      username: rawUser.username,
      tag:      rawUser.username ? `${rawUser.username}#${rawUser.discriminator || '0'}` : rawUser.id,
    },
    replied:  false,
    deferred: false,
    options,

    isCommand:      () => body.type === 2,
    isAutocomplete: () => body.type === 4,

    // Send a DEFERRED response immediately; editReply will follow up via webhook.
    deferReply() {
      resolve({ type: 5, data: { flags: 0 } });
    },

    // Non-deferred reply — send directly in the HTTP response.
    reply(data) {
      resolve({ type: 4, data: buildMessagePayload(data) });
    },

    // Edit the already-sent deferred reply via the follow-up webhook.
    editReply: editReplyViaWebhook,

    // Autocomplete response.
    respond(choices) {
      resolve({ type: 8, data: { choices: choices || [] } });
    },
  };
}

function buildMessagePayload(data) {
  if (typeof data === 'string') return { content: data };
  const payload = { ...data };
  if (payload.ephemeral) {
    payload.flags = (payload.flags || 0) | 64;
    delete payload.ephemeral;
  }
  return payload;
}

// ── Logger ────────────────────────────────────────────────────────────────────
const logger = {
  info:  (...a) => console.log('[info]',  ...a),
  warn:  (...a) => console.warn('[warn]',  ...a),
  error: (...a) => console.error('[error]', ...a),
};

// ── Services (injected into commands) ─────────────────────────────────────────
const services = {
  retriever: { fetchApprovedDeliverable: retriever.fetchApprovedDeliverable },
  delivery:  { formatDiscordResponse: delivery.formatDiscordResponse },
};

// ── Interaction handler ───────────────────────────────────────────────────────
const { handleInteraction } = createDiscordInteraction({ services, logger });

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();

// Keep raw body for signature verification.
app.use(express.raw({ type: 'application/json' }));

app.get('/', (_req, res) => {
  res.send('Umakraft UmaMoe — Discord bot running.');
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

app.post('/interactions', async (req, res) => {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const rawBody   = req.body;

  // 1. Verify signature.
  if (!signature || !timestamp || !verifySignature(rawBody, signature, timestamp)) {
    return res.status(401).send('Invalid request signature');
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).send('Invalid JSON');
  }

  // 2. PING — Discord health check.
  if (body.type === 1) {
    return res.json({ type: 1 });
  }

  // 3. Slash command or autocomplete.
  if (body.type === 2 || body.type === 4) {
    // resolveResponse is called by the adapter when the initial response is ready.
    let initialResponseSent = false;
    const responsePromise = new Promise((resolve) => {
      const adapter = createInteractionAdapter(body, resolve);

      // Run the command handler asynchronously.
      // deferReply() will resolve the promise immediately; editReply() follows up via webhook.
      handleInteraction(adapter).catch((err) => {
        logger.error('handleInteraction error:', err.message);
        if (!initialResponseSent) {
          resolve({ type: 4, data: { content: 'An error occurred. Please try again.', flags: 64 } });
        }
      });
    });

    const response = await responsePromise;
    initialResponseSent = true;
    return res.json(response);
  }

  // Unknown type — acknowledge.
  return res.json({ type: 1 });
});

// ── Gateway client (presence / online status) ─────────────────────────────────
function startGatewayClient() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once('clientReady', () => {
    console.log(`[gateway] Logged in as ${client.user.tag} — bot is now online`);
    client.user.setPresence({
      status: 'online',
      activities: [{ name: 'uma.moe', type: ActivityType.Watching }],
    });
  });

  client.on('error', (err) => {
    console.error('[gateway] Client error:', err.message);
  });

  client.login(BOT_TOKEN).catch((err) => {
    console.error('[gateway] Login failed:', err.message);
  });

  return client;
}

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  // Validate required config.
  const missing = ['DISCORD_PUBLIC_KEY', 'DISCORD_APPLICATION_ID', 'DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']
    .filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('[server] Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  // Bind the HTTP server first so the health check can pass immediately.
  await new Promise((resolve) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] Listening on port ${PORT}`);
      console.log('[server] POST /interactions ready for Discord webhook events');
      resolve();
    });
  });

  // Register slash commands and connect gateway in the background —
  // these are non-blocking so they don't delay the health check.
  registerCommands({
    botToken:      BOT_TOKEN,
    applicationId: APP_ID,
    guildId:       GUILD_ID,
    logger,
  })
    .then((registered) => console.log(`[server] Registered ${registered.length} slash command(s) in guild ${GUILD_ID}`))
    .catch((err) => console.error('[server] Command registration failed:', err.message, err.body || ''));

  startGatewayClient();
}

start();
