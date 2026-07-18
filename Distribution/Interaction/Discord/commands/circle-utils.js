const CIRCLE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?uma\.moe\/circles\/(?<id>\d+)/i;
const CIRCLE_ID_REGEX = /^\d+$/;

const KNOWN_CIRCLE_ALIASES = {
  'umakraft-club': '974470619',
  'my-club': '974470619',
};

function normalizeCircleId(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Circle input must be a non-empty string.');
  }

  const trimmed = input.trim();
  const aliasKey = trimmed.toLowerCase();
  if (KNOWN_CIRCLE_ALIASES[aliasKey]) {
    return KNOWN_CIRCLE_ALIASES[aliasKey];
  }

  const urlMatch = trimmed.match(CIRCLE_URL_REGEX);
  if (urlMatch && urlMatch.groups?.id) {
    return urlMatch.groups.id;
  }

  if (CIRCLE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  throw new Error('Unable to parse circle identifier. Provide a circle ID, a uma.moe/circles URL, or a recognized alias.');
}

module.exports = {
  normalizeCircleId,
};
