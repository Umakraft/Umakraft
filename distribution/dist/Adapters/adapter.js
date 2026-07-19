// Adapter loader for Vault adapters (canonical location)

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadAdapterByName(name, opts = {}){
  const n = String(name || '').toLowerCase();
  if(n === 'inmemory' || n === 'memory' || n === 'mem'){
    const modPath = path.join(__dirname, '..', 'umamoe', 'Vault', 'adapters', 'inmemory.js');
    // accommodate both project locations
    try{
      const mod = await import(modPath);
      return (mod && mod.default) ? mod.default(opts) : (mod || null);
    }catch(e){
      // fallback to embedded adapter under umamoe
      const alt = await import(path.join(__dirname, '..', 'umamoe', 'Vault', 'adapters', 'inmemory.js'));
      return (alt && alt.default) ? alt.default(opts) : alt;
    }
  }

  if(n === 'file' || n === 'disk'){
    const mod = await import(path.join(__dirname, '..', 'umamoe', 'Vault', 'adapters', 'file.js'));
    return (mod && mod.default) ? mod.default(opts.baseDir) : mod;
  }

  // Try to import a relative path or node module
  try{
    const mod = await import(name);
    return (mod && mod.default) ? mod.default(opts) : mod;
  }catch(e){
    throw new Error(`Unknown adapter: ${name}`);
  }
}

async function getDefaultAdapter(){
  const name = process.env.VAULT_ADAPTER || process.env.DEFAULT_VAULT_ADAPTER || 'inmemory';
  return loadAdapterByName(name);
}

export { loadAdapterByName, getDefaultAdapter };
export default { loadAdapterByName, getDefaultAdapter };
