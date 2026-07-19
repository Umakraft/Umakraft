import fs from 'node:fs/promises';
import path from 'node:path';

function sanitizeId(id){ return String(id).replace(/[\\/:*?"<>|\s]/g, '-'); }

export default function createFileAdapter(baseDir){
  const dir = baseDir || process.env.DATA_DIR || path.join(process.cwd(), 'data', 'vault');

  async function ensure(){ await fs.mkdir(dir, { recursive: true }); }

  function entryFilesForId(id){
    return fs.readdir(dir, { withFileTypes: true }).then(list => list
      .filter(d => d.isFile() && d.name.startsWith(sanitizeId(id) + '__'))
      .map(d => path.join(dir, d.name)));
  }

  async function parseFile(file){
    try{
      const txt = await fs.readFile(file, 'utf8');
      return JSON.parse(txt);
    }catch(e){ return null; }
  }

  return {
    async store(envelope){
      if(!envelope || !envelope.trustedData || !envelope.trustedData.id) throw new Error('INVALID_ENVELOPE');
      await ensure();
      const id = sanitizeId(envelope.trustedData.id);
      const ts = (envelope.metadata && envelope.metadata.storedAt) || new Date().toISOString();
      const fname = `${id}__${ts}.json`;
      const target = path.join(dir, fname);
      await fs.writeFile(target, JSON.stringify(envelope, null, 2), 'utf8');
      return { success: true, storedAt: ts };
    },

    async getById(id){
      try{
        const files = await entryFilesForId(id);
        if(files.length === 0) return null;
        // pick latest by timestamp embedded in filename (lexicographic works for ISO timestamps)
        files.sort();
        const latest = files[files.length - 1];
        return await parseFile(latest);
      }catch(e){ throw e; }
    },

    async query(criteria = {}){
      await ensure();
      const entries = [];
      const items = await fs.readdir(dir, { withFileTypes: true });
      for(const it of items){
        if(!it.isFile()) continue;
        const p = path.join(dir, it.name);
        const parsed = await parseFile(p);
        if(!parsed) continue;
        // simple criteria: id or metadata.source
        if(criteria.id && parsed.trustedData?.id !== criteria.id) continue;
        if(criteria.source && parsed.metadata?.source !== criteria.source) continue;
        entries.push(parsed);
      }
      return entries;
    },

    async update(id, patch = {}){
      // read latest, merge, write new version
      const existing = await this.getById(id);
      if(!existing) return { success: false, error: 'NOT_FOUND' };
      const merged = {
        trustedData: Object.assign({}, existing.trustedData, patch.trustedData || {}),
        metadata: Object.assign({}, existing.metadata, patch.metadata || {}, { storedAt: (patch.metadata && patch.metadata.storedAt) || new Date().toISOString() })
      };
      await ensure();
      const fname = `${sanitizeId(id)}__${merged.metadata.storedAt}.json`;
      await fs.writeFile(path.join(dir, fname), JSON.stringify(merged, null, 2), 'utf8');
      return { success: true, storedAt: merged.metadata.storedAt };
    },

    async remove(id, options = {}){
      const files = await entryFilesForId(id);
      let deleted = 0;
      if(options.version){
        const want = path.join(dir, `${sanitizeId(id)}__${options.version}.json`);
        try{ if(await fs.stat(want)){ await fs.unlink(want); deleted = 1; } }catch(e){}
      } else {
        for(const f of files){ try{ await fs.unlink(f); deleted++; }catch(e){} }
      }
      return { success: true, deleted };
    }
  };
}