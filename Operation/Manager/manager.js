// @ts-check
/**
 * Operation/Manager/manager.js
 * ──────────────────────────────
 * Evaluates OperationalLogEntries produced by the Logger, emits a health
 * decision, and routes Critical / Failed / Investigation Required states
 * to Broadcast via postUpdate().
 */

import { log } from '../../core/log.js';
import { postUpdate } from '../../utils/updateLog.js';

const TAG = '[Operation/Manager]';

/** Consecutive failure count thresholds. */
const CF = { WARNING: 1, CRITICAL: 2, FAILED: 3 };

/** Stale age thresholds (ms). Core tasks are more sensitive. */
const STALE = {
  CORE_CRITICAL_MS:     2 * 60 * 60 * 1000,  //  2 h  → Critical
  NONCORE_WARNING_MS:   4 * 60 * 60 * 1000,  //  4 h  → Warning
};

/** Numeric rank so we can find the worst decision across all entries. */
const RANK = { Healthy: 0, Warning: 1, Critical: 2, Failed: 3, 'Investigation Required': 4 };

/**
 * @typedef {'Healthy'|'Warning'|'Critical'|'Failed'|'Investigation Required'} Decision
 */

/**
 * @typedef {Object} ManagerDecision
 * @property {Date}       decidedAt
 * @property {Decision}   decision
 * @property {string[]}   affectedSubjects
 * @property {string}     summary
 * @property {import('../Logger/logger.js').OperationalLogEntry[]} logEntries
 */

/**
 * Derive the worst decision for a single log entry.
 * @param {import('../Logger/logger.js').OperationalLogEntry} entry
 * @returns {Decision}
 */
function entryDecision(entry) {
  const { consecutiveFailures, status, meta } = entry;

  if (consecutiveFailures >= CF.FAILED)   return 'Failed';
  if (consecutiveFailures >= CF.CRITICAL) return 'Critical';
  if (consecutiveFailures >= CF.WARNING)  return 'Warning';

  if (status === 'stale' && meta.staleSince !== null) {
    if (meta.isCore && meta.staleSince > STALE.CORE_CRITICAL_MS)     return 'Critical';
    if (!meta.isCore && meta.staleSince > STALE.NONCORE_WARNING_MS)  return 'Warning';
  }

  if (meta.memoryPressure) return 'Warning';

  return 'Healthy';
}

/**
 * Evaluate all log entries, pick the worst decision, and post to Discord
 * when action is required.
 *
 * @param {import('../Logger/logger.js').OperationalLogEntry[]} logEntries
 * @param {import('discord.js').Client} client
 * @returns {Promise<ManagerDecision>}
 */
export async function evaluate(logEntries, client) {
  /** @type {Decision} */
  let worst = 'Healthy';
  const affected = [];

  for (const entry of logEntries) {
    const d = entryDecision(entry);
    if (RANK[d] > RANK[worst]) worst = d;
    if (d !== 'Healthy') affected.push(entry.stage);
  }

  // Contradictory signal: entry reports ok but staleSince is set past warning threshold.
  const contradictory = logEntries.some(
    e => e.status === 'ok' && e.meta.staleSince !== null && e.meta.staleSince > STALE.NONCORE_WARNING_MS
  );
  if (contradictory && RANK['Investigation Required'] > RANK[worst]) {
    worst = 'Investigation Required';
  }

  const topAffected = affected.slice(0, 3);
  const overflow    = affected.length - topAffected.length;
  const summary = affected.length
    ? `${worst}: ${topAffected.join(', ')}${overflow > 0 ? ` (+${overflow} more)` : ''}`
    : 'All systems healthy';

  /** @type {ManagerDecision} */
  const decision = { decidedAt: new Date(), decision: worst, affectedSubjects: affected, summary, logEntries };

  log.info(`${TAG} ${summary}`);

  // Route to Discord only for states that need human attention
  const NOTIFY = new Set(['Critical', 'Failed', 'Investigation Required']);
  if (NOTIFY.has(worst)) {
    const emoji = worst === 'Failed' ? '🔴' : worst === 'Critical' ? '🟠' : '🔵';
    const body  = affected.length
      ? `Affected: ${affected.slice(0, 5).join(', ')}${affected.length > 5 ? ` (+${affected.length - 5} more)` : ''}`
      : null;

    await postUpdate(client, emoji, `Operation: ${worst}`, body).catch(err =>
      log.warn(`${TAG} failed to post Discord alert:`, err.message)
    );
  }

  return decision;
}
