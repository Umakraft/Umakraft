/**
 * Refiner — computes business-ready derived values from trusted Vault envelopes.
 * Reads historical snapshots to calculate fan gains, rank changes, and flags.
 * Must not write to the Vault; all derived values belong in refinedResult only.
 */
'use strict';

const Vault = require('../../Umamoe/Vault/vault');

const vault = new Vault();

const DEFAULTS = {
  dailyWindowDays:          parseInt(process.env.REFINER_DAILY_WINDOW_DAYS   || '1',      10),
  weeklyWindowDays:         parseInt(process.env.REFINER_WEEKLY_WINDOW_DAYS  || '7',      10),
  monthlyWindowDays:        parseInt(process.env.REFINER_MONTHLY_WINDOW_DAYS || '30',     10),
  largeDailyGainThreshold:  parseInt(process.env.REFINER_LARGE_DAILY_GAIN    || '100000', 10),
  refinerVersion:                    process.env.REFINER_VERSION              || 'v1.0',
};

function nowTs() { return new Date().toISOString(); }
function daysAgoDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

// ── Structured logging ────────────────────────────────────────────────────────
function log(level, message, ctx = {}) {
  console.log(JSON.stringify({ ts: nowTs(), level, module: 'refiner', message, ...ctx }));
}

// ── Test helper ───────────────────────────────────────────────────────────────
// Seeds snapshots directly into the underlying adapter, bypassing the safety
// override below. Used only in unit tests.
async function _seedSnapshotForTest(envelope) {
  if (!vault || !vault.adapter || !vault.adapter.store)
    throw new Error('No underlying adapter to seed');
  return vault.adapter.store(envelope);
}

// ── Safety override ───────────────────────────────────────────────────────────
// Prevent the Refiner from accidentally writing to the Vault.
['store', 'update', 'remove'].forEach(fn => {
  if (typeof vault[fn] === 'function') {
    vault[fn] = async function () {
      throw new Error(`Refiner attempted to call Vault.${fn} — Refiner must not write to Vault`);
    };
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseStoredAt(env) {
  if (!env || !env.metadata) return null;
  return env.metadata.storedAt || env.metadata.refinedAt || null;
}

function safeFans(env) {
  try {
    const v = env && env.trustedData && env.trustedData.fans;
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  } catch { return null; }
}

function safeRank(env) {
  try {
    const v = env && env.trustedData && env.trustedData.rank;
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  } catch { return null; }
}

// ── Core refinement ───────────────────────────────────────────────────────────
async function refine(trustedEnvelope) {
  if (!trustedEnvelope || !trustedEnvelope.trustedData || !trustedEnvelope.trustedData.id) {
    return {
      success: false,
      error: 'REFINER_INVALID_INPUT',
      message: 'Missing trusted envelope or id',
      severity: 'critical',
      retriable: false,
    };
  }

  const id = trustedEnvelope.trustedData.id;

  if (!trustedEnvelope.metadata || !trustedEnvelope.metadata.storedAt) {
    return {
      success: false,
      error: 'REFINER_INVALID_INPUT',
      message: 'Envelope missing Vault metadata.storedAt',
      severity: 'critical',
      retriable: false,
      context: { id },
    };
  }

  const currentFans = trustedEnvelope.trustedData.fans;
  const currentRank = trustedEnvelope.trustedData.rank;

  // Explicit guard — fans/rank must be numbers for gain calculations to be valid.
  const hasFans = typeof currentFans === 'number' && !Number.isNaN(currentFans);
  const hasRank = typeof currentRank === 'number' && !Number.isNaN(currentRank);

  log('info', 'Refine started', { id, hasFans, hasRank, refinerVersion: DEFAULTS.refinerVersion });

  // Read historical snapshots from the Vault.
  const q = await vault.query({ id });
  if (!q || !q.success) {
    log('error', 'Vault query failed', { id });
    return {
      success: false,
      error: 'REFINER_DEPENDENCY_FAILURE',
      message: 'Failed to read from Vault',
      retriable: true,
      timestamp: nowTs(),
      context: { id },
    };
  }

  const snapshots = q.data || [];
  const parsed = snapshots
    .map(s => ({ env: s, ts: new Date(parseStoredAt(s) || 0) }))
    .sort((a, b) => a.ts - b.ts);

  const now      = new Date(parseStoredAt(trustedEnvelope) || Date.now());
  const dailyCut  = daysAgoDate(DEFAULTS.dailyWindowDays);
  const weeklyCut = daysAgoDate(DEFAULTS.weeklyWindowDays);
  const monthlyCut = daysAgoDate(DEFAULTS.monthlyWindowDays);

  function findBefore(date) {
    for (let i = parsed.length - 1; i >= 0; i--) {
      if (parsed[i].ts < date) return parsed[i].env;
    }
    return null;
  }

  const prevLatest      = findBefore(now);
  const dailySnapshot   = findBefore(dailyCut);
  const weeklySnapshot  = findBefore(weeklyCut);
  const monthlySnapshot = findBefore(monthlyCut);
  const earliestSnapshot = parsed.length ? parsed[0].env : null;

  let dailyGain = null, weeklyGain = null, monthlyGain = null,
      lifetimeGain = null, rankChange = null;
  const flags = [];

  try {
    if (hasFans) {
      if (prevLatest)      { const f = safeFans(prevLatest);      if (f !== null) dailyGain   = currentFans - f; }
      if (dailySnapshot)   { const f = safeFans(dailySnapshot);   if (f !== null) dailyGain   = currentFans - f; }
      if (weeklySnapshot)  { const f = safeFans(weeklySnapshot);  if (f !== null) weeklyGain  = currentFans - f; }
      if (monthlySnapshot) { const f = safeFans(monthlySnapshot); if (f !== null) monthlyGain = currentFans - f; }
      if (earliestSnapshot){ const f = safeFans(earliestSnapshot); if (f !== null) lifetimeGain = currentFans - f; }

      if (typeof dailyGain === 'number' && Math.abs(dailyGain) >= DEFAULTS.largeDailyGainThreshold)
        flags.push('large_daily_gain');
    }

    if (hasRank) {
      const prevRank = safeRank(prevLatest);
      if (prevRank !== null) {
        rankChange = currentRank - prevRank;
        if (Math.abs(rankChange) >= 5) flags.push('rank_large_change');
      }
    }
  } catch (err) {
    log('error', 'Calculation error', { id, error: err.message });
    return {
      success: false,
      error: 'REFINER_CALCULATION_ERROR',
      message: err.message,
      severity: 'critical',
      retriable: false,
      context: { id },
    };
  }

  const refined = {
    id,
    fans:         hasFans ? currentFans : null,
    dailyGain:    typeof dailyGain   === 'number' ? dailyGain   : null,
    weeklyGain:   typeof weeklyGain  === 'number' ? weeklyGain  : null,
    monthlyGain:  typeof monthlyGain === 'number' ? monthlyGain : null,
    lifetimeGain: typeof lifetimeGain === 'number' ? lifetimeGain : null,
    rankChange:   typeof rankChange  === 'number' ? rankChange  : null,
    flags,
  };

  const result = {
    success: true,
    refinedResult: refined,
    metadata: {
      sourceStoredAt: trustedEnvelope.metadata.storedAt,
      refinedAt:      nowTs(),
      refinerVersion: DEFAULTS.refinerVersion,
    },
  };

  log('info', 'Refine complete', {
    id,
    dailyGain:  refined.dailyGain,
    weeklyGain: refined.weeklyGain,
    rankChange: refined.rankChange,
    flags,
    snapshotCount: snapshots.length,
  });

  if (process.env.REFINER_VERBOSE === '1')
    console.log('[refiner] verbose', JSON.stringify(result, null, 2));

  return result;
}

// ── Batch (parallel) ──────────────────────────────────────────────────────────
async function refineBatch(envelopes) {
  const results = await Promise.all(envelopes.map(env => refine(env)));
  return { success: true, results };
}

module.exports = {
  refine,
  refineBatch,
  _internal: { vault, seedSnapshot: _seedSnapshotForTest },
};
