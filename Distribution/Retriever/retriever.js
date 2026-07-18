/**
 * Distribution Retriever
 *
 * All Miner calls MUST flow through the Courier, which validates transportability
 * and delivers the result to the Inspector for validation and Vault storage.
 *
 * Pipeline: callMiner → courier.transport(minerResult, inspector) → Inspector → Vault
 *
 * For compound/aggregate Miner responses (circles, rankings) that the Inspector
 * cannot yet validate as a single entity, Courier is still in the chain. If
 * Inspector rejects, we fall back to the raw Miner data so delivery can format it —
 * but we never skip the Courier.
 *
 * Non-Miner operations (link, set_fans) do not touch the Miner at all.
 */
'use strict';

const { callMiner }  = require('../../Umamoe/Miner/miner');
const { transport }  = require('../../Umamoe/Courier/courier');
const inspector      = require('../../Umamoe/Inspector/inspector');
const linkStore      = require('../../Umamoe/Vault/adapters/linkstore');

/**
 * Run a Miner request through the full pipeline: Miner → Courier → Inspector → Vault.
 *
 * Returns a normalised { success, data } envelope for delivery.
 * If Inspector validates the data it is also stored in the Vault.
 * If Inspector rejects (compound shapes, missing id), Courier was still in the chain
 * and we return the raw Miner data so delivery can still format it.
 */
async function pipeline(endpoint, pathParams, queryParams) {
  const minerResult   = await callMiner({ endpoint, pathParams: pathParams || {}, queryParams: queryParams || {} });

  // Miner hard failure — no point transporting.
  if (!minerResult) {
    return { success: false, error: 'RETRIEVER_MINER_NULL', message: 'Miner returned null', retriable: false };
  }

  // Route through Courier (validates transportability → Inspector → Vault).
  const courierResult = await transport(minerResult, inspector);

  // Miner-level failure: Courier passes it through; return as-is.
  if (minerResult.success === false) {
    return minerResult;
  }

  // Inspector accepted and stored in Vault → use validated, normalised data.
  if (courierResult && courierResult.passed === true) {
    return { success: true, data: courierResult.originalData };
  }

  // Inspector rejected (compound / aggregate payload not yet storable as a single entity).
  // Courier WAS in the chain. Return raw Miner data so delivery can still format it.
  const reason = courierResult?.reason || 'unknown';
  console.warn('[retriever] Inspector did not accept data, using raw Miner data.', { reason, endpoint });
  return { success: true, data: minerResult.data };
}

async function fetchApprovedDeliverable(request) {
  if (!request || !request.type) return null;

  const { type, trainerId, circleId, fanCount, userId, targetDiscordId, metadata } = request;

  try {
    switch (type) {

      // ── Trainer profile ─────────────────────────────────────────────────────
      case 'profile':
        return pipeline(
          '/v4/user/profile/{account_id}',
          { account_id: trainerId },
          null,
        );

      // ── Circle info ─────────────────────────────────────────────────────────
      // circleId is pre-normalised by the command before building the request.
      case 'circle':
        return pipeline('/v4/circles', null, { circle_id: circleId });

      // ── Fan-gain rankings ────────────────────────────────────────────────────
      case 'fan_gain':
        return pipeline('/v4/rankings/gains', null, { viewer_id: trainerId });

      // ── Circle member list ──────────────────────────────────────────────────
      // circleId is pre-normalised by the command.
      case 'memberlist':
        return pipeline('/v4/circles', null, { circle_id: circleId });

      // ── Discord ↔ trainer link (no Miner call) ───────────────────────────────
      case 'link': {
        const record = linkStore.setLink(
          targetDiscordId,
          trainerId,
          metadata && metadata.targetDiscordName,
        );
        return {
          success: true,
          data: {
            type:        'link',
            trainerId,
            discordId:   targetDiscordId,
            discordName: record.discordName,
            linkedAt:    record.linkedAt,
          },
        };
      }

      // ── Set fan count (no Miner call) ────────────────────────────────────────
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
