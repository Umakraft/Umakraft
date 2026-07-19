/*
  Simple distribution builder (ESM)
  Usage: node distribution/build_dist.js
*/

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(__dirname, 'manifest.json');
const outDir = path.join(__dirname, 'dist');

async function readManifest(){
  const raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}

async function copyFilePreserve(srcRel){
  const src = path.join(repoRoot, srcRel);
  const dest = path.join(outDir, srcRel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

export async function build(){
  try{
    const files = await readManifest();
    await fs.rm(outDir, { recursive: true, force: true });
    for(const f of files){
      try{
        await copyFilePreserve(f);
        console.log('copied', f);
      }catch(err){
        console.warn('skip', f, err.message);
      }
    }

    // Write a minimal package.json into dist to make it consumable
    let version = '0.0.0';
    try{
      const rootPkgRaw = await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8');
      const rootPkg = JSON.parse(rootPkgRaw);
      version = rootPkg.version || version;
    }catch(_){ }
    const pkg = { name: 'umamoe-distribution', version, main: 'umamoe/index.js' };
    await fs.writeFile(path.join(outDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');

    console.log('\nDistribution built at', outDir);
  }catch(err){
    console.error('failed to build distribution:', err);
    process.exit(1);
  }
}

// run when invoked directly
if(process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replaceAll('\\','/').split('/').pop())){
  build();
}
