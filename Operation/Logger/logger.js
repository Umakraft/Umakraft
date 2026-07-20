// @ts-check
/**
 * Operation/Logger/logger.js
 * ───────────────────────────
 * Transforms InvestigationRecords into structured OperationalLogEntry objects
 * and emits them through core/log.js. Does not evaluate severity — that is
 * the Manager's job.
 */

import { log } from '../../core/log.js';

const TAG = '[Operation/Logger]';

/**
 * @typedef {Object} OperationalLogEntry
 * @property {string}  timestamp
 * @property {string}  pipeline
 * @property {string}  stage
 * @property {'ok'|'warn'|'error'|'stale'|'unknown'} status
 * @property {number|null} duration         - ms since lastRunAt
 * @property {number}  consecutiveFailures
 * @property {string|null} error
 * @property {{ source: string, memoryPressure: boolean, staleSince: number|null, isCore: boolean }} meta
 */

/**
 * Map an InvestigationRecord to a log status string.
 * @param {import('../Investigator/investigator.js').InvestigationRecord} record
 * @returns {'ok'|'warn'|'error'|'stale'|'unknown'}
 */
function mapStatus(record) {
  if (record.lastSuccess === null) return 'unknown';
  if (record.consecutiveFailures >= 2) return 'error';
  if (record.consecutiveFailures === 1) return 'warn';
  if (record.staleSince !== null)       return 'stale';
  return 'ok';
}

/**
 * Derive the top-level pipeline label from a record.
 * @param {import('../Investigator/investigator.js').InvestigationRecord} record
 * @returns {string}
 */
function derivePipeline(record) {
  if (record.source !== 'taskRegistry') return record.source;
  // Use the first segment of the task name (e.g. 'dataSync' → 'dataSync')
  return record.subject.split(':')[0];
}

/**
 * Format a stale duration into a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
function fmtStale(ms) {
  const mins = Math.round(ms / 60_000);
  return mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}min`;
}

/**
 * Consume investigation records and produce structured log entries.
 * Emits to core/log.js for non-ok entries.
 *
 * @param {import('../Investigator/investigator.js').InvestigationRecord[]} records
 * @returns {OperationalLogEntry[]}
 */
export function createLogEntries(records) {
  /** @type {OperationalLogEntry[]} */
  const entries = [];

  for (const rec of records) {
    const status   = mapStatus(rec);
    const pipeline = derivePipeline(rec);
    const duration = rec.lastRunAt ? Date.now() - rec.lastRunAt.getTime() : null;

    /** @type {OperationalLogEntry} */
    const entry = {
      timestamp:          rec.investigatedAt.toISOString(),
      pipeline,
      stage:              rec.subject,
      status,
      duration,
      consecutiveFailures: rec.consecutiveFailures,
      error:              rec.lastError,
      meta: {
        source:         rec.source,
        memoryPressure: rec.memoryPressure,
        staleSince:     rec.staleSince,
        isCore:         rec.isCore,
      },
    };

    entries.push(entry);

    // Emit to core/log.js — healthy tasks are silent to avoid noise every 5 min
    switch (status) {
      case 'warn':
        log.warn(`${TAG} ${rec.subject} — consecutive failure #${rec.consecutiveFailures}: ${rec.lastError ?? 'unknown'}`);
        break;
      case 'error':
        log.error(`${TAG} ${rec.subject} — ${rec.consecutiveFailures} consecutive failures: ${rec.lastError ?? 'unknown'}`);
        break;
      case 'stale':
        log.error(`${TAG} ${rec.subject} — stale for ${fmtStale(rec.staleSince ?? 0)}${rec.lastError ? `: ${rec.lastError}` : ''}`);
        break;
      case 'unknown':
        log.debug(`${TAG} ${rec.subject} — never run`);
        break;
      default:
        break; // 'ok' — silent
    }
  }

  return entries;
}
