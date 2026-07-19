// Broker: entry point that polls Refinery/Depot for products and runs the Broadcast pipeline.
// It also performs restart-recovery by scanning Archive for incomplete records.

export default class Broker {
  constructor({ archiveInspector, archiveTransporter, archive } = {}){
    this.archiveInspector = archiveInspector; // may be undefined; lazy init
    this.archiveTransporter = archiveTransporter; // may be undefined; lazy init
    this.archive = archive; // may be undefined; lazy init
  }

  async _lazyLoad(){
    if(!this.archive){
      const mod = await import('../Archive/archive.js');
      this.archive = new (mod.default)();
    }
    if(!this.archiveInspector){
      const ia = await import('../archive-inspector/archiveInspector.js');
      this.archiveInspector = new (ia.default)({ archive: this.archive });
    }
    if(!this.archiveTransporter){
      const at = await import('../archive_transporter/archiveTransporter.js');
      const Ann = await import('../Announcer/announcer.js');
      const announcer = new (Ann.default)({ archive: this.archive });
      this.archiveTransporter = new (at.default)({ archive: this.archive, announcer });
    }
  }

  async _loadDepot(){
    // create the in-repo depot adapter used by Refinery/Depot
    const mod = await import('../../Refinery/Depot/depot.js').catch(()=>null);
    // Handle both ESM default export, CJS module.exports=function, and CJS wrapped default
    let candidate = mod && (mod.default || mod);

    // If candidate already looks like an adapter instance, return it
    if(candidate && typeof candidate.query === 'function') return candidate;

    // If candidate is a factory function, call it and return result
    if(typeof candidate === 'function'){
      try{
        const inst = candidate();
        if(inst && typeof inst.query === 'function') return inst;
        return inst;
      }catch(e){
        // fallthrough to other heuristics
      }
    }

    // If dynamic import didn't yield usable module, try require via createRequire (CJS fallback)
    try{
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const cjs = require('../../Refinery/Depot/depot.js');
      // if the require returned a function, call it
      if(typeof cjs === 'function'){
        const inst = cjs();
        if(inst && typeof inst.query === 'function') return inst;
        return inst;
      }
      if(cjs && typeof cjs.query === 'function') return cjs;
      if(cjs && typeof cjs.createDepotAdapter === 'function'){
        const inst = cjs.createDepotAdapter();
        if(inst && typeof inst.query === 'function') return inst;
        return inst;
      }
    }catch(e){ /* ignore */ }

    // Some CJS modules expose a named factory
    if(mod && typeof mod.createDepotAdapter === 'function'){
      try{
        const inst = mod.createDepotAdapter();
        if(inst && typeof inst.query === 'function') return inst;
        return inst;
      }catch(e){}
    }

    // As a last resort, return whatever we have (may be undefined)
    return candidate;
  }

  async runOnce(){
    await this._lazyLoad();

    // 1) Recovery: find incomplete archive records and route to transporter
    const incomplete = await this.archive.queryIncomplete();
    if(incomplete && incomplete.success && Array.isArray(incomplete.data)){
      for(const rec of incomplete.data){
        try{
          await this.archiveTransporter.transport(rec.notificationKey);
        }catch(e){ console.error('Broker: recovery transport failed', e.message); }
      }
    }

    // 2) Fetch compiled products from Depot and hand them to Archive-Inspector
    try{
      const depot = await this._loadDepot();
      const q = await depot.query({});
      const products = (q && q.results) ? q.results : [];
      for(const p of products){
        try{
          const res = await this.archiveInspector.inspect(p);
          if(res && res.success){
            // new archive record created; ask transporter to hand off for delivery
            await this.archiveTransporter.transport(res.notificationKey);
          }
        }catch(e){ console.error('Broker: inspect failed', e.message); }
      }
    }catch(err){
      console.error('Broker: depot fetch failed', err.message);
    }

    return { success: true };
  }
}
