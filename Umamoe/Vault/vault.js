/**
 * Vault — trusted data storage with swappable adapter.
 *
 * Default adapter selection:
 *   - production / development → file adapter  (data/vault.json)
 *   - test environment         → in-memory adapter (no disk I/O)
 *
 * Pass a custom adapter instance to the constructor to override.
 */
'use strict';

function defaultAdapter() {
  if (process.env.NODE_ENV === 'test') {
    return require('./adapters/inmemory')();
  }
  return require('./adapters/file')();
}

class Vault {
  constructor(adapter) {
    this.adapter = adapter || defaultAdapter();
  }

  async store(envelope) {
    if (!envelope || typeof envelope !== 'object')
      return { success: false, error: 'VAULT_INVALID_ENVELOPE', message: 'Envelope must be an object', retriable: false };
    if (!envelope.trustedData)
      return { success: false, error: 'VAULT_INVALID_ENVELOPE', message: 'Missing trustedData', retriable: false };
    if (!envelope.metadata || typeof envelope.metadata !== 'object')
      return { success: false, error: 'VAULT_INVALID_METADATA', message: 'Missing metadata', retriable: false };
    try {
      return await this.adapter.store(envelope);
    } catch (err) {
      return { success: false, error: 'VAULT_STORAGE_FAILURE', message: err.message, retriable: true };
    }
  }

  async getById(id) {
    try {
      const res = await this.adapter.getById(id);
      if (!res) return { success: false, error: 'VAULT_NOT_FOUND', retriable: false };
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: 'VAULT_RETRIEVAL_FAILURE', message: err.message, retriable: true };
    }
  }

  async getAll() {
    try {
      const res = await this.adapter.getAll();
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: 'VAULT_RETRIEVAL_FAILURE', message: err.message, retriable: true };
    }
  }

  async query(criteria) {
    try {
      const res = await this.adapter.query(criteria);
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: 'VAULT_RETRIEVAL_FAILURE', message: err.message, retriable: true };
    }
  }

  async update(id, patch) {
    try {
      return await this.adapter.update(id, patch);
    } catch (err) {
      return { success: false, error: 'VAULT_UPDATE_FAILURE', message: err.message, retriable: true };
    }
  }

  async remove(id, options) {
    try {
      return await this.adapter.remove(id, options);
    } catch (err) {
      return { success: false, error: 'VAULT_DELETION_FAILURE', message: err.message, retriable: true };
    }
  }
}

module.exports = Vault;
