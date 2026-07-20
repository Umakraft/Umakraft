// @ts-check
/**
 * Refinery/Refiner/refiner.js
 * ────────────────────────────
 * Department orchestrator for Refinery/Refiner.
 *
 * Responsibilities:
 *   refine(trustedEnvelope)          — envelope-pipeline: compute gains from Vault history
 *   refineBatch(envelopes)           — batch version
 *   refineFromDomain(members, date)  — domain bridge: delegates to assimilated domain files
 *
 * Domain files owned by this department:
 *   ./umaStats.js       — member stat computation (classifyMembers, computeMemberStats)
 *   ./velocity.js       — 7-day rolling velocity + monthly projection
 *   ./achievements.js   — daily achievement tier announcements
 *   ./milestoneEval.js  — milestone eligibility (meetsThreshold)
 */

import Vault from '../../umamoe/Vault/vault.js';
import { log } from '../../core/log.js';
import { safeRun, withRetry } from '../../core/errors.js';

// ── Domain file re-exports (assimilated files owned by this department) ───────
export { classifyMembers, computeMemberStats } from './umaStats.js';
export { computeAndSaveVelocity } from './velocity.js';
export { checkDailyAchievements } from './achievements.js';
export { meetsThreshold } from './milestoneEval.js';

// ── Envelope-pipeline implementation ─────────────────────────────────────────

const vault = new Vault();

const DEFAULTS = {
  dailyWindowDays:         parseInt(process.env.REFINER_DAILY_WINDOW_DAYS   || '1',       10),
  weeklyWindowDays:        parseInt(process.env.REFINER_WEEKLY_WINDOW_DAYS  || '7',       10),
  monthlyWindowDays:       parseInt(process.env.REFINER_MONTHLY_WINDOW_DAYS || '30',      10),
  largeDailyGainThreshold: parseInt(process.env.REFINER_LARGE_DAILY_GAIN    || '100000',  10),
  refinerVersion:          process.env.REFINER_VERSION || 'v2.0',
};

// Safety: Refiner must not write to the Vault — only read.
['store', 'update', 'remove'].forEach(fn => {
  if (typeof vault[fn] === 'function') {
    vault[fn] = async () => {
      throw new Error(`Refiner attempted to call Vault.${fn} — Refiner must not write to Vault`);
    };
  }
});

// Test helper: seed snapshots directly into the underlying adapter (bypasses safety).
async function _seedSnapshotForTest(envelope) {
  if (!vault || !vault.adapter || !vault.adapter.store) {
    throw new Error('No underlying adapter to seed');
  }
  return vault.adapter.store(envelope);
}

function nowTs() { return new Date().toISOString(); }

function parseStoredAt(env) {
  if (!env || !env.metadata) return null;
  return env.metadata.storedAt || env.metadata.refinedAt || null;
}

function daysAgoDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function safeFans(env) {
  try { return (env?.trustedData && typeof env.trustedData.fans === 'number') ? env.trustedData.fans : null; }
  catch { return null; }
}

function safeRank(env) {
  try { return (env?.trustedData && typeof env.trustedData.rank === 'number') ? env.trustedData.rank : null; }
  catch { return null; }
}

/**
 * Refine one trusted envelope against its Vault history.
 * @param {object} trustedEnvelope
 * @returns {Promise<object>} Refined result envelope
 */
export async function refine(trustedEnvelope) {
  if (!trustedEnvelope?.trustedData?.id) {
    return { success: false, error: 'REFINER_INVALID_INPUT', message: 'Missing trusted envelope or id', severity: 'critical', retriable: false };
  }

  const id = trustedEnvelope.trustedData.id;
  if (!trustedEnvelope.metadata?.storedAt) {
    return { success: false, error: 'REFINER_INVALID_INPUT', message: 'Envelope missing Vault metadata.storedAt', severity: 'critical', retriable: false, context: { id } };
  }

  const q = await withRetry(() => vault.query({ id }), { maxAttempts: 3, context: `refiner:vault-query:${id}` });
  if (!q?.success) {
    return { success: false, error: 'REFINER_DEPENDENCY_FAILURE', message: 'Failed to read from Vault', retriable: true, timestamp: nowTs(), context: { id } };
  }

  const snapshots = q.data || [];
  const parsed = snapshots
    .map(s => ({ env: s, ts: new Date(parseStoredAt(s) || s.metadata?.refinedAt || s.metadata?.storedAt || 0) }))
    .sort((a, b) => a.ts - b.ts);

  const currentFans = trustedEnvelope.trustedData.fans;
  const currentRank = trustedEnvelope.trustedData.rank;
  const now         = new Date(parseStoredAt(trustedEnvelope) || Date.now());

  function findBefore(date) {
    for (let i = parsed.length - 1; i >= 0; i--) {
      if (parsed[i].ts < date) return parsed[i].env;
    }
    return null;
  }

  const prevLatest      = findBefore(now);
  const dailySnapshot   = findBefore(daysAgoDate(DEFAULTS.dailyWindowDays));
  const weeklySnapshot  = findBefore(daysAgoDate(DEFAULTS.weeklyWindowDays));
  const monthlySnapshot = findBefore(daysAgoDate(DEFAULTS.monthlyWindowDays));
  const earliestSnapshot = parsed.length ? parsed[0].env : null;

  let dailyGain = null, weeklyGain = null, monthlyGain = null, lifetimeGain = null, rankChange = null;
  const flags = [];

  try {
    if (prevLatest)      { const f = safeFans(prevLatest);      if (f !== null) dailyGain   = currentFans - f; }
    if (dailySnapshot)   { const f = safeFans(dailySnapshot);   if (f !== null) dailyGain   = currentFans - f; }
    if (weeklySnapshot)  { const f = safeFans(weeklySnapshot);  if (f !== null) weeklyGain  = currentFans - f; }
    if (monthlySnapshot) { const f = safeFans(monthlySnapshot); if (f !== null) monthlyGain = currentFans - f; }
    if (earliestSnapshot){ const f = safeFans(earliestSnapshot);if (f !== null) lifetimeGain = currentFans - f; }

    const prevRank = safeRank(prevLatest);
    if (prevRank !== null && typeof currentRank === 'number') rankChange = currentRank - prevRank;

    if (typeof dailyGain  === 'number' && Math.abs(dailyGain)  >= DEFAULTS.largeDailyGainThreshold) flags.push('large_daily_gain');
    if (typeof rankChange === 'number' && Math.abs(rankChange) >= 5)                                 flags.push('rank_large_change');
  } catch (err) {
    return { success: false, error: 'REFINER_CALCULATION_ERROR', message: err.message, severity: 'critical', retriable: false, context: { id } };
  }

  const refined = {
    id,
    fans:         currentFans,
    dailyGain:    typeof dailyGain    === 'number' ? dailyGain    : null,
    weeklyGain:   typeof weeklyGain   === 'number' ? weeklyGain   : null,
    monthlyGain:  typeof monthlyGain  === 'number' ? monthlyGain  : null,
    lifetimeGain: typeof lifetimeGain === 'number' ? lifetimeGain : null,
    rankChange:   typeof rankChange   === 'number' ? rankChange   : null,
    flags,
  };

  const result = {
    success: true,
    refinedResult: refined,
    metadata: {
      sourceStoredAt: trustedEnvelope.metadata?.storedAt,
      refinedAt: nowTs(),
      refinerVersion: DEFAULTS.refinerVersion,
    },
  };

  log.debug(`[Refiner] refined id=${id} dailyGain=${refined.dailyGain} flags=${flags.join(',') || 'none'}`);
  return result;
}

/**
 * Refine a batch of trusted envelopes sequentially.
 */
export async function refineBatch(envelopes) {
  const results = [];
  for (const env of envelopes) {
    results.push(await safeRun(() => refine(env), `refiner:batch:${env?.trustedData?.id ?? '?'}`));
  }
  return { success: true, results };
}

/**
 * Domain bridge: called after a circle sync to run Refiner-owned domain logic.
 * This is NOT part of the envelope pipeline — it uses the assimilated production files.
 *
 * @param {object[]} enrichedMembers  — output of computeMemberStats()
 * @param {string}   circleId
 * @param {Date}     date
 */
export async function refineFromDomain(enrichedMembers, circleId, date) {
  const { computeAndSaveVelocity } = await import('./velocity.js');
  await safeRun(
    () => computeAndSaveVelocity(circleId, enrichedMembers, date),
    `refiner:velocity:${circleId}`
  );
  log.debug(`[Refiner] domain refinement complete for ${circleId}`);
}

// ── Test-only internal surface ────────────────────────────────────────────────
export const _internal = { vault, seedSnapshot: _seedSnapshotForTest };
