const createInMemoryAdapter = require('./adapters/inmemory');

// Simple vault wrapper that uses adapter pattern. Default to in-memory adapter.
class Vault {
  constructor(adapter){
    this.adapter = adapter || createInMemoryAdapter();
  }

  async store(envelope){
    try{
      return await this.adapter.store(envelope);
    }catch(err){
      return { success: false, error: 'VAULT_STORAGE_FAILURE', message: err.message, retriable: true };
    }
  }

  async getById(id){
    try{
      const res = await this.adapter.getById(id);
      if(!res) return { success: false, error: 'VAULT_NOT_FOUND', retriable: false };
      return { success: true, data: res };
    }catch(err){
      return { success: false, error: 'VAULT_RETRIEVAL_FAILURE', message: err.message, retriable: true };
    }
  }

  async query(criteria){
    try{
      const res = await this.adapter.query(criteria);
      return { success: true, data: res };
    }catch(err){
      return { success: false, error: 'VAULT_RETRIEVAL_FAILURE', message: err.message, retriable: true };
    }
  }

  async update(id, patch){
    try{
      const res = await this.adapter.update(id, patch);
      return res;
    }catch(err){
      return { success: false, error: 'VAULT_UPDATE_FAILURE', message: err.message, retriable: true };
    }
  }

  async remove(id, options){
    try{
      const res = await this.adapter.remove(id, options);
      return res;
    }catch(err){
      return { success: false, error: 'VAULT_DELETION_FAILURE', message: err.message, retriable: true };
    }
  }
}

module.exports = Vault;
