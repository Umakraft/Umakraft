/**
 * File-based Vault storage adapter.
 * Persists data as a JSON file on disk so records survive restarts.
 * Atomic writes (write-to-tmp then rename) prevent data corruption.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// Candidate fields used to derive a stable key when trustedData.id is missing.
const ID_FIELD_CANDIDATES = ['id', 'viewer_id', 'trainer_id', 'account_id', 'circle_id', 'veteran_id'];

function resolveId(trustedData) {
  for (const field of ID_FIELD_CANDIDATES) {
    const v = trustedData[field];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return null;
}

module.exports = function createFileAdapter(options = {}) {
  const filePath = options.filePath
    || path.join(process.cwd(), 'data', 'vault.json');
  const dir = path.dirname(filePath);

  function ensureDir() {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  function load() {
    ensureDir();
    try {
      if (!fs.existsSync(filePath)) return {};
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return {};
    }
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
    entries.sort((a, b) => b.version.localeCompare(a.version));
    return entries[0];
  }

  return {
    async store(envelope) {
      if (!envelope || !envelope.trustedData) throw new Error('INVALID_ENVELOPE: missing trustedData');
      const id = resolveId(envelope.trustedData);
      if (!id) throw new Error('INVALID_ENVELOPE: cannot derive an id from trustedData');

      const version = (envelope.metadata && envelope.metadata.storedAt) || new Date().toISOString();
      const key = `${id}:${version}`;
      const store = load();
      store[key] = { id, version, envelope };
      save(store);
      return { success: true, storedAt: version };
    },

    async getById(id) {
      const store = load();
      const entry = latestForId(store, id);
      return entry ? entry.envelope : null;
    },

    async getAll() {
      const store = load();
      return Object.values(store).map(e => e.envelope);
    },

    async query(criteria = {}) {
      const store = load();
      return Object.values(store)
        .map(e => e.envelope)
        .filter(envelope => {
          if (criteria.id && envelope.trustedData && envelope.trustedData.id !== criteria.id) return false;
          if (criteria.source && envelope.metadata && envelope.metadata.source !== criteria.source) return false;
          return true;
        });
    },

    async update(id, patch) {
      const store = load();
      const entry = latestForId(store, id);
      if (!entry) return { success: false, error: 'NOT_FOUND' };
      const merged = {
        trustedData: Object.assign({}, entry.envelope.trustedData, patch.trustedData || {}),
        metadata:    Object.assign({}, entry.envelope.metadata,    patch.metadata    || {}),
      };
      const version = merged.metadata.storedAt || new Date().toISOString();
      store[`${id}:${version}`] = { id, version, envelope: merged };
      save(store);
      return { success: true, storedAt: version };
    },

    async remove(id, options = {}) {
      const store = load();
      const keys = Object.keys(store).filter(k => k.startsWith(id + ':'));
      if (options.version) {
        const key = `${id}:${options.version}`;
        const existed = key in store;
        delete store[key];
        save(store);
        return { success: existed };
      }
      let deleted = 0;
      for (const k of keys) { delete store[k]; deleted++; }
      save(store);
      return { success: true, deleted };
    },
  };
};
