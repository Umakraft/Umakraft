import createInMemoryAdapter from './adapters/inmemory.js';
import { loadAdapterByName, getDefaultAdapter } from '../../Adapters/adapter.js';

// Simple vault wrapper that uses adapter pattern. Default to configured adapter (loader) or in-memory fallback.
class Vault {
  constructor(adapter){
    // adapter may be an adapter instance or falsy; store a promise that resolves to the adapter instance
    if(adapter){
      this._adapterPromise = Promise.resolve(adapter);
    } else {
      // try to load default adapter via loader; fall back to in-memory
      this._adapterPromise = (async () => {
        try{
          const a = await getDefaultAdapter();
          return a || createInMemoryAdapter();
        }catch(_){
          return createInMemoryAdapter();
        }
      })();
    }
  }

  async store(envelope){
    const adapter = await this._adapterPromise;
    if(!envelope || typeof envelope !== 'object'){
      return { success: false, error: 'VAULT_INVALID_ENVELOPE', message: 'Envelope must be an object', retriable: false };
    }
    if(!envelope.trustedData){
      return { success: false, error: 'VAULT_INVALID_ENVELOPE', message: 'Missing trustedData', retriable: false };
    }
    if(!envelope.metadata || typeof envelope.metadata !== 'object'){
      return { success: false, error: 'VAULT_INVALID_METADATA', message: 'Missing metadata', retriable: false };
    }
    try{
      return await adapter.store(envelope);
    }catch(err){
      return { success: false, error: 'VAULT_STORAGE_FAILURE', message: err.message, retriable: true };
    }
  }

  async getById(id){
    const adapter = await this._adapterPromise;
    try{
      const res = await adapter.getById(id);
      if(!res) return { success: false, error: 'VAULT_NOT_FOUND', retriable: false };
      return { success: true, data: res };
    }catch(err){
      return { success: false, error: 'VAULT_RETRIEVAL_FAILURE', message: err.message, retriable: true };
    }
  }

  async query(criteria){
    const adapter = await this._adapterPromise;
    try{
      const res = await adapter.query(criteria);
      return { success: true, data: res };
    }catch(err){
      return { success: false, error: 'VAULT_RETRIEVAL_FAILURE', message: err.message, retriable: true };
    }
  }

  async update(id, patch){
    const adapter = await this._adapterPromise;
    try{
      const res = await adapter.update(id, patch);
      return res;
    }catch(err){
      return { success: false, error: 'VAULT_UPDATE_FAILURE', message: err.message, retriable: true };
    }
  }

  async remove(id, options){
    const adapter = await this._adapterPromise;
    try{
      const res = await adapter.remove(id, options);
      return res;
    }catch(err){
      return { success: false, error: 'VAULT_DELETION_FAILURE', message: err.message, retriable: true };
    }
  }
}

export default Vault;