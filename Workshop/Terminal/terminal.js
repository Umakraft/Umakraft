/**
 * Terminal — Workshop departure point.
 * Accepts approved deliverables from the Validator and holds them for Distribution.
 *
 * Adapter selection:
 *   NODE_ENV=test  → in-memory (per-instance, no disk I/O)
 *   production/dev → file adapter (data/terminal.json)
 *
 * receive() upserts — a re-submitted deliverable with the same id overwrites the
 * previous entry rather than throwing. This allows safe retries from Distribution.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ── File adapter ──────────────────────────────────────────────────────────────

function createFileStore(filePath) {
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

  function save(data) {
    ensureDir();
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  return { load, save };
}

// ── Guard ─────────────────────────────────────────────────────────────────────

function validateDeliverable(deliverable) {
  if (!deliverable || typeof deliverable !== 'object')
    throw new Error('Terminal requires a valid approved deliverable object.');
  if (!deliverable.id)
    throw new Error('Terminal deliverable must include an id.');
}

// ── Factory ───────────────────────────────────────────────────────────────────

module.exports = function createTerminal(options = {}) {
  const useFile = options.useFile !== undefined
    ? options.useFile
    : process.env.NODE_ENV !== 'test';

  const filePath = options.filePath
    || path.join(process.cwd(), 'data', 'terminal.json');

  const fileStore = useFile ? createFileStore(filePath) : null;

  // ── Internal store access ─────────────────────────────────────────────────

  function readStore() {
    return fileStore ? fileStore.load() : {};
  }

  function writeStore(data) {
    if (fileStore) fileStore.save(data);
  }

  // In-memory mirror for non-file mode (per-instance Map-like object).
  let _mem = {};

  function getAll() {
    return fileStore ? readStore() : _mem;
  }

  function setRecord(id, record) {
    if (fileStore) {
      const data = readStore();
      data[id] = record;
      writeStore(data);
    } else {
      _mem[id] = record;
    }
  }

  function delRecord(id) {
    if (fileStore) {
      const data = readStore();
      const existed = id in data;
      delete data[id];
      writeStore(data);
      return existed;
    } else {
      const existed = id in _mem;
      delete _mem[id];
      return existed;
    }
  }

  function getRecord(id) {
    return getAll()[id] || null;
  }

  // ── Public interface ──────────────────────────────────────────────────────

  async function receive(deliverable) {
    validateDeliverable(deliverable);

    const record = {
      deliverable,
      storedAt: new Date().toISOString(),
      status:   'ready',
      metadata: {
        id:     deliverable.id,
        source: deliverable.metadata?.source || null,
      },
    };

    setRecord(deliverable.id, record);
    return { success: true, id: deliverable.id, storedAt: record.storedAt };
  }

  // Alias kept for callers that use the longer name.
  async function storeApproved(deliverable) {
    return receive(deliverable);
  }

  async function listReady() {
    return Object.values(getAll())
      .filter(e => e.status === 'ready')
      .map(e => ({ id: e.metadata.id, storedAt: e.storedAt, metadata: e.metadata }));
  }

  async function getReleaseMetadata(id) {
    const entry = getRecord(id);
    if (!entry) return null;
    return {
      id:        entry.metadata.id,
      storedAt:  entry.storedAt,
      status:    entry.status,
      metadata:  entry.metadata,
    };
  }

  async function retrieve(id) {
    const entry = getRecord(id);
    return entry ? entry.deliverable : null;
  }

  async function remove(id) {
    const existed = delRecord(id);
    return { success: existed };
  }

  return { receive, storeApproved, listReady, getReleaseMetadata, retrieve, remove };
};
