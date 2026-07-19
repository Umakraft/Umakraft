import Vault from '../Vault/vault.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Simple file adapter used by the Refinery when no adapter is provided.
class FileAdapter {
  constructor(baseDir){
    this.baseDir = baseDir || process.env.DATA_DIR || path.join(process.cwd(), 'data', 'refinery');
  }

  async store(refined){
    await fs.mkdir(this.baseDir, { recursive: true });
    const id = refined.id || (refined.trustedData && (refined.trustedData.id || refined.trustedData.trainer_id)) || `r-${Date.now()}`;
    const file = path.join(this.baseDir, `${id}.refined.json`);
    await fs.writeFile(file, JSON.stringify(refined, null, 2), 'utf8');
    return { success: true, path: file };
  }
}

export default class Refinery {
  constructor({ vault, adapter } = {}){
    this.vault = vault || new Vault();
    this.adapter = adapter || new FileAdapter();
  }

  // Process a single trusted envelope and produce a refined artifact.
  async processTrusted(envelope){
    if(!envelope || !envelope.trustedData) return { success: false, error: 'REFINERY_INVALID_INPUT' };
    const td = envelope.trustedData;
    const metadata = envelope.metadata || {};

    const refined = {
      id: td.id || td.trainer_id || `r-${Date.now()}`,
      trustedData: td,
      metadata: {
        source: metadata.source || null,
        inspectedAt: metadata.inspectedAt || null,
        processedAt: new Date().toISOString()
      },
      // Lightweight summary fields downstream consumers expect
      summary: {
        name: td.name || td.trainer_name || null,
        fans: (td.fans != null) ? td.fans : (td.rank_score != null ? td.rank_score : null),
        rank_score: td.rank_score ?? null
      }
    };

    const storeResult = await this.adapter.store(refined);
    return { success: true, refined, storage: storeResult };
  }

  // Process all trusted envelopes from the Vault (query -> process each)
  async processAll(){
    const q = await this.vault.query({});
    if(!q || q.success === false) return { success: false, error: 'REFINERY_VAULT_QUERY_FAILED', details: q };
    const items = q.data || [];
    const out = [];
    for(const env of items){
      const r = await this.processTrusted(env);
      out.push(r);
    }
    return { success: true, processed: out.length, results: out };
  }
}