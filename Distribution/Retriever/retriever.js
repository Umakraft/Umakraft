/**
 * Distribution Retriever
 * Fetches approved deliverables from the Miner pipeline based on request type.
 * Link associations are persisted via the link store so they survive restarts.
 */
'use strict';

const { callMiner } = require('../../Umamoe/Miner/miner');
const linkStore     = require('../../Umamoe/Vault/adapters/linkstore');

async function fetchApprovedDeliverable(request) {
  if (!request || !request.type) return null;

  const { type, trainerId, circleId, fanCount, userId, targetDiscordId, metadata } = request;

  try {
    switch (type) {

      case 'profile':
        return callMiner({
          endpoint: '/v4/user/profile/{account_id}',
          pathParams: { account_id: trainerId },
        });

      case 'circle':
        return callMiner({
          endpoint: '/v4/circles',
          queryParams: { circle_id: circleId },
        });

      case 'fan_gain':
        return callMiner({
          endpoint: '/v4/rankings/gains',
          queryParams: { viewer_id: trainerId },
        });

      case 'link': {
        // Persist the Discord user ↔ trainer association.
        const record = linkStore.setLink(
          targetDiscordId,
          trainerId,
          metadata && metadata.targetDiscordName,
        );
        return {
          success: true,
          data: {
            type: 'link',
            trainerId,
            discordId:   targetDiscordId,
            discordName: record.discordName,
            linkedAt:    record.linkedAt,
          },
        };
      }

      case 'set_fans':
        return {
          success: true,
          data: {
            type:       'set_fans',
            fanCount,
            userId,
            recordedAt: new Date().toISOString(),
          },
        };

      default:
        return null;
    }
  } catch (err) {
    console.error(`[retriever] fetchApprovedDeliverable failed for type=${type}:`, err.message);
    return null;
  }
}

module.exports = { fetchApprovedDeliverable };
