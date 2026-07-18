/**
 * In-memory Depot adapter — for tests and local development.
 * Each call creates its own Map; no module-level singleton.
 */
'use strict';

module.exports = function createInMemoryAdapter() {
  const store = new Map(); // per-instance — not shared across calls

  function latestForId(id) {
    const entries = Array.from(store.values()).filter(e => e.id === id);
    if (!entries.length) return null;
    entries.sort((a, b) => (a.version > b.version ? -1 : 1));
    return entries[0];
  }

  return {
    async put(product) {
      const key = `${product.id}:${product.version}`;
      if (store.has(key))
        return { success: false, error: 'DEPOT_CONFLICT', message: `id=${product.id} version=${product.version} already exists`, retriable: false };
      store.set(key, { id: product.id, version: product.version, product, provenance: product.provenance || null });
      return { success: true, storedAt: new Date().toISOString() };
    },

    async get(id, options = {}) {
      if (options.version) {
        const entry = store.get(`${id}:${options.version}`);
        return entry ? entry.product : null;
      }
      const entry = latestForId(id);
      return entry ? entry.product : null;
    },

    async getAll() {
      return Array.from(store.values()).map(e => e.product);
    },

    async del(id, options = {}) {
      if (options.version) {
        const key = `${id}:${options.version}`;
        const removed = store.delete(key);
        return { success: removed };
      }
      const keys = Array.from(store.keys()).filter(k => k.startsWith(id + ':'));
      let deleted = 0;
      for (const k of keys) { if (store.delete(k)) deleted++; }
      return { success: true, deleted };
    },

    async query(filter = {}) {
      const results = Array.from(store.values())
        .map(e => e.product)
        .filter(p => {
          if (filter.id && p.id !== filter.id) return false;
          return true;
        });
      return { results };
    },
  };
};
