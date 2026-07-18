/**
 * Compiler — assembles refined results into canonical compiled products
 * and persists them to the Depot.
 *
 * Field routing from flat Refiner output:
 *   id               → product top-level id
 *   name, characters, achievements → compiledProduct.profile
 *   fans, *Gain, rankChange, flags, rank → compiledProduct.stats
 *   unknown flat fields → compiledProduct.stats (default bucket)
 *
 * Nested refinedResult.profile / refinedResult.stats are also supported
 * for future multi-source Refiner composition.
 */
'use strict';

const createDepot = require('../Depot/depot');

const depot = createDepot();

const COMPILER_VERSION = 'v2.0';

// Fields that belong in the profile bucket of the compiled product.
const PROFILE_FIELDS = new Set(['name', 'characters', 'achievements']);

// Fields that belong in the stats bucket.
const STATS_FIELDS = new Set([
  'fans', 'dailyGain', 'weeklyGain', 'monthlyGain', 'lifetimeGain',
  'rankChange', 'flags', 'rank',
]);

function nowTs() { return new Date().toISOString(); }

function log(level, message, ctx = {}) {
  console.log(JSON.stringify({ ts: nowTs(), level, module: 'compiler', message, ...ctx }));
}

function categoriseField(key) {
  if (key === 'id')           return 'id';
  if (PROFILE_FIELDS.has(key)) return 'profile';
  if (STATS_FIELDS.has(key))   return 'stats';
  return 'stats'; // unknown flat fields default to stats
}

// ── Merge ─────────────────────────────────────────────────────────────────────
// Merges one or more refinedResult envelopes into a compiledProduct shape.
// Conflict resolution: latest metadata.refinedAt timestamp wins.
function mergeEnvelopes(envelopes) {
  const compiled  = { profile: {}, stats: {} };
  const provenance = [];
  const fieldSources = {}; // key → winning refinedAt timestamp
  let id = null;

  for (const env of envelopes) {
    const refined = (env && env.refinedResult) ? env.refinedResult : {};
    const meta    = (env && env.metadata)      ? env.metadata      : {};
    provenance.push({
      refinerVersion: meta.refinerVersion || null,
      refinedAt:      meta.refinedAt      || null,
    });

    const candidateAt = meta.refinedAt || nowTs();

    // Support nested profile/stats from future multi-source Refiners.
    if (refined.profile && typeof refined.profile === 'object') {
      for (const [k, v] of Object.entries(refined.profile)) {
        const key = `profile.${k}`;
        if (!fieldSources[key] || candidateAt > fieldSources[key]) {
          compiled.profile[k] = v;
          fieldSources[key]   = candidateAt;
        }
      }
    }

    if (refined.stats && typeof refined.stats === 'object') {
      for (const [k, v] of Object.entries(refined.stats)) {
        const key = `stats.${k}`;
        if (!fieldSources[key] || candidateAt > fieldSources[key]) {
          compiled.stats[k] = v;
          fieldSources[key] = candidateAt;
        }
      }
    }

    // Route flat fields (the current Refiner output format).
    for (const [k, v] of Object.entries(refined)) {
      if (k === 'profile' || k === 'stats') continue; // handled above

      const cat = categoriseField(k);

      if (cat === 'id') {
        // First non-null id wins; later timestamps can override.
        const key = 'id';
        if (!id || (fieldSources[key] && candidateAt > fieldSources[key])) {
          id = String(v);
          fieldSources[key] = candidateAt;
        }
      } else {
        const key = `${cat}.${k}`;
        if (!fieldSources[key] || candidateAt > fieldSources[key]) {
          compiled[cat][k] = v;
          fieldSources[key] = candidateAt;
        }
      }
    }
  }

  // Final fallback for id.
  if (!id) {
    id = compiled.profile.id
      || compiled.stats.id
      || (envelopes[0] && envelopes[0].refinedResult && envelopes[0].refinedResult.id)
      || null;
  }

  return { compiled, provenance, id };
}

// ── compile ───────────────────────────────────────────────────────────────────
async function compile(envelopes, template) {
  if (!envelopes || (Array.isArray(envelopes) && envelopes.length === 0)) {
    return { success: false, error: 'COMPILER_INVALID_INPUT', message: 'No envelopes provided', retriable: false };
  }

  const arr = Array.isArray(envelopes) ? envelopes : [envelopes];
  const { compiled, provenance, id } = mergeEnvelopes(arr);
  const compiledAt = nowTs();

  const compiledProduct = {
    id,
    version: compiledAt,
    profile: compiled.profile,
    stats:   compiled.stats,
  };

  const prov = {
    sources:         provenance,
    compiledAt,
    compilerVersion: COMPILER_VERSION,
  };

  log('info', 'Compile complete', { id, compilerVersion: COMPILER_VERSION, sourceCount: arr.length });

  return { success: true, compiledProduct, provenance: prov };
}

// ── compileAndStore ───────────────────────────────────────────────────────────
async function compileAndStore(envelopes, template) {
  const res = await compile(envelopes, template);
  if (!res.success) return res;

  const toStore = {
    id:             res.compiledProduct.id,
    version:        res.compiledProduct.version,
    compiledProduct: res.compiledProduct,
    provenance:     res.provenance,
  };

  log('info', 'Persisting to Depot', { id: toStore.id, version: toStore.version });

  try {
    const put = await depot.put(toStore);
    if (!put || !put.success)
      return { success: false, error: 'COMPILER_PERSISTENCE_FAILURE', message: 'Depot put failed', retriable: true };

    log('info', 'Depot persist success', { id: toStore.id, storedAt: put.storedAt });
    return { success: true, compiledProduct: res.compiledProduct, storedAt: put.storedAt };
  } catch (err) {
    log('error', 'Depot persist error', { id: toStore.id, error: err.message });
    return { success: false, error: 'COMPILER_PERSISTENCE_FAILURE', message: err.message, retriable: true };
  }
}

// ── compileBatch (parallel) ───────────────────────────────────────────────────
async function compileBatch(jobs) {
  const results = await Promise.all(
    jobs.map(job => compileAndStore(job.envelopes, job.template)),
  );
  return { success: true, results };
}

module.exports = { compile, compileAndStore, compileBatch };
