/**
 * File-based Depot adapter — persists compiled products to data/depot.json.
 * Atomic writes (write-to-tmp then rename) prevent corruption on crash.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

module.exports = function createFileAdapter(options = {}) {
  const filePath = options.filePath
    || path.join(process.cwd(), 'data', 'depot.json');
  const dir = path.dirname(filePath);

  function ensureDir() {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  function load() {
    ensureDir();
    try {
      if (!fs.existsSync(filePath)) return {};
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return {}; }
  }

  function save(store) {
    ensureDir();
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  function latestForId(store, id) {
    const entries = Object.values(store).filter(e => e.id === id);
    if (!entries.length) return null;
    entries.sort((a, b) => (a.version > b.version ? -1 : 1));
    return entries[0];
  }

  return {
    async put(product) {
      const key = `${product.id}:${product.version}`;
      const store = load();
      if (key in store)
        return { success: false, error: 'DEPOT_CONFLICT', message: `id=${product.id} version=${product.version} already exists`, retriable: false };
      store[key] = { id: product.id, version: product.version, product, provenance: product.provenance || null };
      save(store);
      return { success: true, storedAt: new Date().toISOString() };
    },

    async get(id, options = {}) {
      const store = load();
      if (options.version) {
        const entry = store[`${id}:${options.version}`];
        return entry ? entry.product : null;
      }
      const entry = latestForId(store, id);
      return entry ? entry.product : null;
    },

    async getAll() {
      const store = load();
      return Object.values(store).map(e => e.product);
    },

    async del(id, options = {}) {
      const store = load();
      if (options.version) {
        const key = `${id}:${options.version}`;
        const existed = key in store;
        delete store[key];
        save(store);
        return { success: existed };
      }
      const keys = Object.keys(store).filter(k => k.startsWith(id + ':'));
      let deleted = 0;
      for (const k of keys) { delete store[k]; deleted++; }
      save(store);
      return { success: true, deleted };
    },

    async query(filter = {}) {
      const store = load();
      const results = Object.values(store)
        .map(e => e.product)
        .filter(p => {
          if (filter.id && p.id !== filter.id) return false;
          return true;
        });
      return { results };
    },
  };
};
