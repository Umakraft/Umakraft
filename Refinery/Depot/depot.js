// @ts-check
/**
 * Refinery/Depot/depot.js
 * ────────────────────────
 * Department orchestrator + in-memory adapter for Refinery/Depot.
 *
 * `createDepotAdapter()` returns an in-memory store suitable for development
 * and pipeline tests. For production SQLite-backed persistence, callers should
 * use the domain files directly:
 *   ./linksDb.js             — fan-link records (Discord ID ↔ viewer ID)
 *   ./linksRepository.js     — higher-level repository over linksDb
 *   ./leaderboardSnapshotDb.js — leaderboard snapshot persistence
 *
 * Domain files are re-exported for convenient single-import access.
 */

import { log } from '../../core/log.js';

// ── Domain file re-exports ────────────────────────────────────────────────────
export {
  initLinksDb, isLinksDbInitialized, isProtectedLink,
  setLink, removeLink, getLinkedViewerId, getAllLinks,
  getLinkedInfo, getDiscordIdByViewerId,
} from './linksDb.js';
export { linkRepository } from './linksRepository.js';
export {
  initLeaderboardSnapshotDb, isSnapshotDbInitialized,
  saveSnapshot, getSnapshot, getAvailableDates,
  getTrainerRankHistory, getPersonalBest, getNo1Finishes,
  getAvgMonthlyRank, getAllPersonalBests,
} from './leaderboardSnapshotDb.js';

// ── In-memory adapter (envelope pipeline / tests) ─────────────────────────────

// Module-level store is intentional: a single in-memory depot shared across
// the broker ↔ compiler ↔ inspector cycle within one process lifetime.
const _store = new Map();

function _latestEntryForId(id) {
  const entries = Array.from(_store.values()).filter(e => e.id === id);
  if (!entries.length) return null;
  entries.sort((a, b) => (a.version < b.version ? 1 : -1));
  return entries[0];
}

async function put(product) {
  if (!product?.id || !product?.version) throw new Error('DEPOT_INVALID_PRODUCT: id and version required');
  const key = `${product.id}:${product.version}`;
  _store.set(key, { id: product.id, version: product.version, product, provenance: product.provenance || null });
  const storedAt = new Date().toISOString();
  log.debug(`[Depot] stored ${key}`);
  return { success: true, storedAt };
}

async function get(id, options = {}) {
  if (options.version) {
    const entry = _store.get(`${id}:${options.version}`);
    return entry ? entry.product : null;
  }
  const entry = _latestEntryForId(id);
  return entry ? entry.product : null;
}

async function del(id, options = {}) {
  if (options.version) {
    const removed = _store.delete(`${id}:${options.version}`);
    return { success: removed };
  }
  const keys = Array.from(_store.keys()).filter(k => k.startsWith(`${id}:`));
  let deleted = 0;
  for (const k of keys) { if (_store.delete(k)) deleted++; }
  return { success: true, deleted };
}

async function query(filter = {}) {
  const results = Array.from(_store.values())
    .map(e => e.product)
    .filter(p => {
      if (filter.id && p.id !== filter.id) return false;
      return true;
    });
  return { results };
}

/**
 * Returns an in-memory depot adapter instance.
 * @returns {{ put: Function, get: Function, del: Function, query: Function }}
 */
export default function createDepotAdapter() {
  return { put, get, del, query };
}
