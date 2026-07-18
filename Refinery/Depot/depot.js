/**
 * Depot — stores and retrieves finished compiled products.
 *
 * Adapter selection:
 *   NODE_ENV=test  → in-memory (no disk I/O, per-instance store)
 *   production/dev → file adapter  (data/depot.json)
 *
 * Pass a custom adapter to the factory to override.
 */
'use strict';

const createFileAdapter     = require('./adapters/file');
const createInMemoryAdapter = require('./adapters/inmemory');

module.exports = function createDepot(adapter) {
  const store = adapter || (
    process.env.NODE_ENV === 'test'
      ? createInMemoryAdapter()
      : createFileAdapter()
  );

  return {
    /**
     * Store a compiled product.
     * Returns DEPOT_CONFLICT if the exact id+version already exists.
     */
    async put(product) {
      if (!product || !product.id || !product.version)
        return { success: false, error: 'DEPOT_INVALID_INPUT', message: 'product.id and product.version are required', retriable: false };
      try {
        return await store.put(product);
      } catch (err) {
        return { success: false, error: 'DEPOT_PERSISTENCE_FAILURE', message: err.message, retriable: true };
      }
    },

    /**
     * Retrieve the latest compiled product for an id, or a specific version.
     */
    async get(id, options = {}) {
      if (!id)
        return { success: false, error: 'DEPOT_INVALID_INPUT', message: 'id is required', retriable: false };
      try {
        const product = await store.get(id, options);
        if (!product)
          return { success: false, error: 'DEPOT_NOT_FOUND', message: `No product found for id=${id}`, retriable: false };
        return { success: true, product };
      } catch (err) {
        return { success: false, error: 'DEPOT_PERSISTENCE_FAILURE', message: err.message, retriable: true };
      }
    },

    /**
     * Return all stored compiled products.
     */
    async getAll() {
      try {
        const products = await store.getAll();
        return { success: true, products };
      } catch (err) {
        return { success: false, error: 'DEPOT_PERSISTENCE_FAILURE', message: err.message, retriable: true };
      }
    },

    /**
     * Delete a product by id (all versions, or a specific version).
     */
    async del(id, options = {}) {
      if (!id)
        return { success: false, error: 'DEPOT_INVALID_INPUT', message: 'id is required', retriable: false };
      try {
        return await store.del(id, options);
      } catch (err) {
        return { success: false, error: 'DEPOT_PERSISTENCE_FAILURE', message: err.message, retriable: true };
      }
    },

    /**
     * Query products. Supports filter by { id }.
     */
    async query(filter = {}, options = {}) {
      try {
        return await store.query(filter, options);
      } catch (err) {
        return { success: false, error: 'DEPOT_PERSISTENCE_FAILURE', message: err.message, retriable: true };
      }
    },
  };
};
