import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE = path.join(process.cwd(), 'data', 'broadcast', 'archive');

function sanitizeFilename(s){
  return String(s).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export default class Archive {
  constructor(baseDir){
    this.baseDir = baseDir || process.env.BROADCAST_ARCHIVE_DIR || DEFAULT_BASE;
  }

  async _ensureDir(){
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async _writeRecord(notificationKey, record){
    await this._ensureDir();
    const now = new Date().toISOString();
    const file = path.join(this.baseDir, `${sanitizeFilename(notificationKey)}__${now}.json`);
    await fs.writeFile(file, JSON.stringify(record, null, 2), 'utf8');
    return { success: true, path: file };
  }

  async insert(record){
    if(!record || typeof record !== 'object') return { success: false, error: 'ARCHIVE_INVALID_RECORD' };
    const notificationKey = record.notificationKey || `${record.type || 'notif'}:${record.id || record.trainer_id || Date.now()}`;
    const base = {
      notificationKey,
      createdAt: new Date().toISOString(),
      deliveryFlags: { channel_sent: 0, dm_member_sent: 0, dm_leader_sent: 0 },
      history: [],
    };
    const full = Object.assign({}, base, record);
    const w = await this._writeRecord(notificationKey, full);
    return { success: true, notificationKey, storage: w };
  }

  async _findLatestFile(notificationKey){
    try{
      const files = await fs.readdir(this.baseDir);
      const prefix = sanitizeFilename(notificationKey) + '__';
      const matches = files.filter(f => f.startsWith(prefix));
      if(!matches.length) return null;
      matches.sort();
      return path.join(this.baseDir, matches[matches.length - 1]);
    }catch(e){
      return null;
    }
  }

  async getByKey(notificationKey){
    const file = await this._findLatestFile(notificationKey);
    if(!file) return { success: false, error: 'ARCHIVE_NOT_FOUND' };
    try{
      const raw = await fs.readFile(file, 'utf8');
      return { success: true, record: JSON.parse(raw) };
    }catch(e){
      return { success: false, error: 'ARCHIVE_READ_FAILED', message: e.message };
    }
  }

  async queryIncomplete(){
    await this._ensureDir();
    const out = [];
    const files = await fs.readdir(this.baseDir);
    for(const f of files){
      if(!f.endsWith('.json')) continue;
      try{
        const raw = await fs.readFile(path.join(this.baseDir, f), 'utf8');
        const rec = JSON.parse(raw);
        const flags = rec.deliveryFlags || {};
        if(flags.channel_sent === 0 || flags.dm_member_sent === 0 || flags.dm_leader_sent === 0){
          out.push(rec);
        }
      }catch(e){ /* ignore parse errors */ }
    }
    return { success: true, data: out };
  }

  async updateFlags(notificationKey, updates){
    const got = await this.getByKey(notificationKey);
    if(!got || !got.success) return got;
    const rec = got.record;
    rec.deliveryFlags = Object.assign({}, rec.deliveryFlags || {}, updates || {});
    rec.updatedAt = new Date().toISOString();
    const w = await this._writeRecord(notificationKey, rec);
    return { success: true, storage: w, record: rec };
  }

  async appendHistory(notificationKey, entry){
    const got = await this.getByKey(notificationKey);
    if(!got || !got.success) return got;
    const rec = got.record;
    rec.history = rec.history || [];
    rec.history.push(Object.assign({ ts: new Date().toISOString() }, entry || {}));
    const w = await this._writeRecord(notificationKey, rec);
    return { success: true, storage: w, record: rec };
  }
}
