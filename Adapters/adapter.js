// Adapter loader for Vault adapters (canonical location)

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function safeImportFsPath(fsPath){
  // Convert filesystem path to file:// URL for reliable dynamic import across platforms
  const url = pathToFileURL(fsPath).href;
  return import(url);
}

async function loadAdapterByName(name, opts = {}){
  const n = String(name || '').toLowerCase();
  if(n === 'inmemory' || n === 'memory' || n === 'mem'){
    const modPath = path.join(__dirname, '..', 'umamoe', 'Vault', 'adapters', 'inmemory.js');
    // accommodate both project locations
    try{
      const mod = await safeImportFsPath(modPath);
      return (mod && mod.default) ? mod.default(opts) : (mod || null);
    }catch(e){
      // fallback to embedded adapter under umamoe (same path, kept for parity)
      const altPath = path.join(__dirname, '..', 'umamoe', 'Vault', 'adapters', 'inmemory.js');
      const alt = await safeImportFsPath(altPath);
      return (alt && alt.default) ? alt.default(opts) : alt;
    }
  }

  if(n === 'file' || n === 'disk'){
    const modPath = path.join(__dirname, '..', 'umamoe', 'Vault', 'adapters', 'file.js');
    const mod = await safeImportFsPath(modPath);
    return (mod && mod.default) ? mod.default(opts.baseDir) : mod;
  }

  // Try to import a module specifier or a provided path
  try{
    // if the name looks like a path on disk, convert to file URL
    if(name.includes(path.sep) || name.startsWith('.') || name.startsWith('/')){
      const mod = await safeImportFsPath(path.isAbsolute(name) ? name : path.join(__dirname, '..', name));
      return (mod && mod.default) ? mod.default(opts) : mod;
    }

    const mod = await import(name);
    return (mod && mod.default) ? mod.default(opts) : mod;
  }catch(e){
    throw new Error(`Unknown adapter: ${name} (${e.message})`);
  }
}

async function getDefaultAdapter(){
  const name = process.env.VAULT_ADAPTER || process.env.DEFAULT_VAULT_ADAPTER || 'file';
  return loadAdapterByName(name);
}

export { loadAdapterByName, getDefaultAdapter };
export default { loadAdapterByName, getDefaultAdapter };
