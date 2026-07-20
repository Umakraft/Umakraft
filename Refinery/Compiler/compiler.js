// @ts-check
/**
 * Refinery/Compiler/compiler.js
 * ──────────────────────────────
 * Department orchestrator for Refinery/Compiler.
 *
 * Responsibilities:
 *   compile(envelopes)          — merge refined envelopes into a compiled product
 *   compileAndStore(envelopes)  — compile + persist to Depot
 *   compileBatch(jobs)          — batch version
 *   syncAndAggregate(circleIds) — domain bridge: delegates to assimilated sync files
 *
 * Domain files owned by this department:
 *   ./dataSync.js     — per-circle live sync from uma.moe
 *   ./circleQueue.js  — multi-circle sync queue with concurrency control
 *   ./aggregation.js  — weekly/monthly gain aggregate materialisation
 */

import createDepotAdapter from '../Depot/depot.js';
import { log } from '../../core/log.js';
import { safeRun } from '../../core/errors.js';

// ── Domain file re-exports (assimilated files owned by this department) ───────
export { syncCircleData, syncStatus } from './dataSync.js';
export { runSyncQueue, getQueueStatus }  from './circleQueue.js';
export { computeAndSaveAggregates, getCirclePeriodAggregates } from './aggregation.js';

// ── Envelope-pipeline implementation ─────────────────────────────────────────

const depot = createDepotAdapter();

function nowTs() { return new Date().toISOString(); }

/**
 * Merge an array of refined envelopes into a single compiled product.
 * Later refinedAt wins for scalar conflicts.
 */
function mergeEnvelopes(envelopes) {
  const compiled      = { profile: {}, stats: {} };
  const provenance    = [];
  const fieldSources  = {};

  for (const env of envelopes) {
    const refined = env?.refinedResult ?? {};
    const meta    = env?.metadata ?? {};
    provenance.push({ refinerVersion: meta.refinerVersion || null, refinedAt: meta.refinedAt || null });

    if (refined.profile && typeof refined.profile === 'object') {
      for (const k of Object.keys(refined.profile)) {
        const key = `profile.${k}`;
        const candidateAt = meta.refinedAt || nowTs();
        if (!fieldSources[key] || candidateAt > fieldSources[key]) {
          compiled.profile[k] = refined.profile[k];
          fieldSources[key] = candidateAt;
        }
      }
    }

    if (refined.stats && typeof refined.stats === 'object') {
      for (const k of Object.keys(refined.stats)) {
        const key = `stats.${k}`;
        const candidateAt = meta.refinedAt || nowTs();
        if (!fieldSources[key] || candidateAt > fieldSources[key]) {
          compiled.stats[k] = refined.stats[k];
          fieldSources[key] = candidateAt;
        }
      }
    }

    // Flat numeric / scalar fields → stats bucket
    for (const k of Object.keys(refined)) {
      if (['profile', 'stats'].includes(k)) continue;
      const key = `stats.${k}`;
      const candidateAt = meta.refinedAt || nowTs();
      if (!fieldSources[key] || candidateAt > fieldSources[key]) {
        compiled.stats[k] = refined[k];
        fieldSources[key] = candidateAt;
      }
    }
  }

  const id = compiled.stats.id || envelopes[0]?.refinedResult?.id || null;
  return { compiled, provenance, id };
}

/**
 * Compile (merge) one or more refined envelopes. Does NOT persist.
 */
export async function compile(envelopes, _template) {
  if (!envelopes || (Array.isArray(envelopes) && envelopes.length === 0)) {
    return { success: false, error: 'COMPILER_INVALID_INPUT', message: 'No envelopes provided', retriable: false };
  }

  const arr = Array.isArray(envelopes) ? envelopes : [envelopes];
  const { compiled, provenance, id } = mergeEnvelopes(arr);
  const compiledAt = nowTs();

  return {
    success: true,
    compiledProduct: Object.assign({ id, version: compiledAt }, compiled),
    provenance: { sources: provenance, compiledAt, compilerVersion: 'v2.0' },
  };
}

/**
 * Compile and persist the result to the Depot adapter.
 */
export async function compileAndStore(envelopes, template) {
  const res = await compile(envelopes, template);
  if (!res.success) return res;

  const toStore = {
    id: res.compiledProduct.id,
    version: res.compiledProduct.version,
    compiledProduct: res.compiledProduct,
    provenance: res.provenance,
  };

  try {
    const put = await depot.put(toStore);
    if (!put?.success) {
      return { success: false, error: 'COMPILER_PERSISTENCE_FAILURE', message: 'Depot put failed', retriable: true };
    }
    log.debug(`[Compiler] stored product id=${toStore.id} v=${toStore.version}`);
    return { success: true, compiledProduct: res.compiledProduct, storedAt: put.storedAt };
  } catch (err) {
    return { success: false, error: 'COMPILER_PERSISTENCE_FAILURE', message: err.message, retriable: true };
  }
}

/**
 * Compile and store a batch of jobs sequentially.
 */
export async function compileBatch(jobs) {
  const results = [];
  for (const job of jobs) {
    results.push(await safeRun(() => compileAndStore(job.envelopes, job.template), `compiler:batch`));
  }
  return { success: true, results };
}

/**
 * Domain bridge: trigger a sync + aggregate pass for one or more circles.
 * This is NOT part of the envelope pipeline — it delegates to the assimilated production files.
 *
 * @param {string[]} circleIds
 * @returns {Promise<{ success: boolean, circleId: string }[]>}
 */
export async function syncAndAggregate(circleIds) {
  const { runSyncQueue } = await import('./circleQueue.js');
  const circles = circleIds.map(id => ({ id }));
  await safeRun(() => runSyncQueue(circles), 'compiler:syncAndAggregate');
  log.debug(`[Compiler] syncAndAggregate complete for ${circleIds.join(', ')}`);
  return circleIds.map(id => ({ success: true, circleId: id }));
}
