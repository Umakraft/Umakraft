const fetch = require('node-fetch');
const { getCommandData } = require('./index');

const DISCORD_API_BASE = 'https://discord.com/api/v10';

function buildEndpoint({ applicationId, guildId }) {
  if (!applicationId) {
    throw new Error('Discord applicationId is required for command registration.');
  }

  if (guildId) {
    return `${DISCORD_API_BASE}/applications/${applicationId}/guilds/${guildId}/commands`;
  }

  return `${DISCORD_API_BASE}/applications/${applicationId}/commands`;
}

async function registerCommands({ botToken, applicationId, guildId, logger }) {
  if (!botToken) {
    throw new Error('Discord botToken is required for command registration.');
  }

  const endpoint = buildEndpoint({ applicationId, guildId });
  const commands = getCommandData();

  if (!commands.length) {
    throw new Error('No Discord command definitions were found to register.');
  }

  logger?.info?.('Registering Discord commands', { endpoint, count: commands.length });

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Discord command registration failed: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  const registered = await response.json();
  logger?.info?.('Discord commands registered successfully', { registeredCount: registered.length });
  return registered;
}

module.exports = {
  registerCommands,
};
