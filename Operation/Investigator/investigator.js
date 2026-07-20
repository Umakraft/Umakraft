// @ts-check
/**
 * Operation/Investigator/investigator.js
 * ────────────────────────────────────────
 * Collects raw facts from taskRegistry, syncStatus, timelineStatus, and
 * process runtime. Produces InvestigationRecord objects — no evaluation,
 * no severity judgement.
 */

import { getTaskStats } from '../../core/taskRegistry.js';
import { syncStatus } from '../../tasks/dataSync.js';
import { timelineStatus } from '../../umamoe/timeline/timeline.js';

/** Tasks treated as core — stale detection triggers Critical (not Warning). */
const CORE_TASKS = new Set(['dataSync', 'milestones']);

/**
 * Estimate the expected run interval for a cron expression in milliseconds.
 * Falls back to 1 hour when the pattern is not recognised.
 * @param {string} expr
 * @returns {number}
 */
function cronToIntervalMs(expr) {
  if (!expr) return 60 * 60 * 1000;
  // Every N minutes: */N * * * *
  const everyN = expr.match(/^\*\/(\d+) \* \* \* \*$/);
  if (everyN) return parseInt(everyN[1]) * 60 * 1000;
  // Hourly: N * * * *
  if (/^\d+ \* \* \* \*$/.test(expr)) return 60 * 60 * 1000;
  // Daily: N N * * *
  if (/^\d+ \d+ \* \* \*$/.test(expr)) return 24 * 60 * 60 * 1000;
  // Weekly: N N * * N
  if (/^\d+ \d+ \* \* \d$/.test(expr)) return 7 * 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
}

/**
 * @typedef {Object} InvestigationRecord
 * @property {Date}            investigatedAt
 * @property {'taskRegistry'|'dataSync'|'timeline'|'runtime'} source
 * @property {string}          subject
 * @property {number}          consecutiveFailures
 * @property {Date|null}       lastRunAt
 * @property {boolean|null}    lastSuccess
 * @property {string|null}     lastError
 * @property {number|null}     staleSince   - ms since last successful run, null if not stale
 * @property {boolean}         memoryPressure
 * @property {boolean}         isCore
 * @property {Record<string, unknown>} extra
 */

/**
 * Collect investigation records from all live data sources.
 * @returns {InvestigationRecord[]}
 */
export function investigate() {
  const now = Date.now();
  const { heapUsed, heapTotal, rss } = process.memoryUsage();
  const memoryPressure = heapUsed / heapTotal > 0.9;

  /** @type {InvestigationRecord[]} */
  const records = [];

  // ── taskRegistry ──────────────────────────────────────────────────────────
  const taskStats = getTaskStats();
  for (const [name, stat] of Object.entries(taskStats)) {
    const intervalMs = cronToIntervalMs(stat.cronExpr ?? '');
    const lastRunMs  = stat.lastRunAt ? new Date(stat.lastRunAt).getTime() : null;
    const staleSince = lastRunMs !== null && now - lastRunMs > 2 * intervalMs
      ? now - lastRunMs
      : null;

    records.push({
      investigatedAt:     new Date(now),
      source:             'taskRegistry',
      subject:            name,
      consecutiveFailures: stat.consecutiveFailures ?? 0,
      lastRunAt:          stat.lastRunAt ? new Date(stat.lastRunAt) : null,
      lastSuccess:        stat.lastSuccess ?? null,
      lastError:          stat.lastError  ?? null,
      staleSince,
      memoryPressure,
      isCore:             CORE_TASKS.has(name),
      extra:              { cronExpr: stat.cronExpr, totalRuns: stat.totalRuns },
    });
  }

  // ── syncStatus (per-circle) ───────────────────────────────────────────────
  for (const [circleId, s] of syncStatus.entries()) {
    const lastRunMs  = s.lastSyncAt ? new Date(s.lastSyncAt).getTime() : null;
    const staleSince = lastRunMs !== null && now - lastRunMs > 2 * 60 * 60 * 1000
      ? now - lastRunMs
      : null;

    records.push({
      investigatedAt:     new Date(now),
      source:             'dataSync',
      subject:            `dataSync:circle:${circleId}`,
      consecutiveFailures: s.consecutiveFailures ?? 0,
      lastRunAt:          s.lastSyncAt ? new Date(s.lastSyncAt) : null,
      lastSuccess:        s.consecutiveFailures === 0 && s.lastSyncAt !== null,
      lastError:          s.lastSyncError ?? null,
      staleSince,
      memoryPressure,
      isCore:             true,
      extra:              { circleId },
    });
  }

  // ── timelineStatus ────────────────────────────────────────────────────────
  {
    const lastRunMs  = timelineStatus.lastUpdateAt
      ? new Date(timelineStatus.lastUpdateAt).getTime()
      : null;
    // Timeline runs once a day; stale after 2 days
    const staleSince = lastRunMs !== null && now - lastRunMs > 2 * 24 * 60 * 60 * 1000
      ? now - lastRunMs
      : null;

    records.push({
      investigatedAt:     new Date(now),
      source:             'timeline',
      subject:            'timeline',
      consecutiveFailures: timelineStatus.lastError ? 1 : 0,
      lastRunAt:          timelineStatus.lastUpdateAt ? new Date(timelineStatus.lastUpdateAt) : null,
      lastSuccess:        !timelineStatus.lastError && timelineStatus.lastUpdateAt !== null,
      lastError:          timelineStatus.lastError ?? null,
      staleSince,
      memoryPressure,
      isCore:             false,
      extra:              {
        totalPosted: timelineStatus.totalPosted,
        isRunning:   timelineStatus.isRunning,
      },
    });
  }

  // ── runtime ───────────────────────────────────────────────────────────────
  records.push({
    investigatedAt:     new Date(now),
    source:             'runtime',
    subject:            'process',
    consecutiveFailures: 0,
    lastRunAt:          null,
    lastSuccess:        true,
    lastError:          null,
    staleSince:         null,
    memoryPressure,
    isCore:             false,
    extra:              {
      heapUsedMb:    Math.round(heapUsed   / 1024 / 1024),
      heapTotalMb:   Math.round(heapTotal  / 1024 / 1024),
      rssMb:         Math.round(rss        / 1024 / 1024),
      uptimeSeconds: Math.round(process.uptime()),
    },
  });

  return records;
}
