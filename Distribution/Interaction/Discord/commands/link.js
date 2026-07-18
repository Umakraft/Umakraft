const fetch = require('node-fetch');

const SEARCH_ENDPOINT = 'https://uma.moe/api/v3/search';
const MAX_AUTOCOMPLETE_SUGGESTIONS = 25;
const AUTOCOMPLETE_TIMEOUT_MS = 8000;
const API_KEY = process.env.UMA_MOE_API_KEY || process.env.API_KEY || null;

function normalizeTrainerSuggestion(trainer) {
  const trainerId = trainer.trainer_id || trainer.id || trainer.viewer_id;
  const trainerName = trainer.trainer_name || trainer.name || trainer.trainerName || trainerId;
  if (!trainerId) {
    return null;
  }

  const label = trainerName && trainerId ? `${trainerName} (${trainerId})` : `${trainerId}`;
  return { name: label, value: trainerId };
}

async function fetchTrainerSuggestions(query) {
  if (!query) {
    return [];
  }

  const params = new URLSearchParams({ trainer_name: query, limit: `${MAX_AUTOCOMPLETE_SUGGESTIONS}` });
  const headers = { 'Accept': 'application/json' };
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
    headers['X-API-Key'] = API_KEY;
  }
  const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
    headers,
    timeout: AUTOCOMPLETE_TIMEOUT_MS,
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const trainers = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.trainers)
    ? payload.trainers
    : Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.results)
    ? payload.results
    : [];

  return trainers
    .map(normalizeTrainerSuggestion)
    .filter(Boolean)
    .slice(0, MAX_AUTOCOMPLETE_SUGGESTIONS);
}

module.exports = {
  data: {
    name: 'link',
    description: 'Links a Discord user to a Uma Musume trainer profile.',
    options: [
      {
        name: 'trainer',
        description: 'Trainer name or ID',
        type: 3,
        required: true,
        autocomplete: true,
      },
      {
        name: 'discord_user',
        description: 'Discord user to link (defaults to yourself)',
        type: 6,
        required: false,
      },
    ],
  },
  async autocomplete({ interaction, logger }) {
    const focusedValue = interaction.options.getFocused?.();
    if (!focusedValue) {
      return interaction.respond?.([]);
    }

    const suggestions = await fetchTrainerSuggestions(focusedValue).catch((error) => {
      logger?.warn?.('Trainer autocomplete failed', { query: focusedValue, error: error?.message });
      return [];
    });

    return interaction.respond?.(suggestions);
  },
  async execute({ interaction, services }) {
    const trainerId = interaction.options.getString('trainer');
    const discordUser = interaction.options.getUser('discord_user') || interaction.user;
    const targetDiscordId = discordUser?.id || interaction.user.id;
    const targetDiscordName = discordUser?.tag || discordUser?.username || 'Unknown User';

    if (!trainerId) {
      return {
        content: 'Please select a trainer from autocomplete or enter a valid trainer identifier.',
        ephemeral: true,
      };
    }

    await interaction.deferReply();

    const request = {
      type: 'link',
      trainerId,
      userId: interaction.user.id,
      targetDiscordId,
      source: 'discord',
      metadata: {
        targetDiscordName,
      },
    };

    const product = await services.retriever.fetchApprovedDeliverable(request);
    if (!product) {
      return {
        content: 'Unable to link your account. Please try again later.',
        ephemeral: true,
      };
    }

    return services.delivery.formatDiscordResponse({ interaction, product, command: 'link' });
  },
};
