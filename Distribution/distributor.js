// @ts-check
/**
 * Distribution/distributor.js
 * ────────────────────────────
 * The Distributor is the handoff layer between Workshop/Terminal and
 * Broadcast/Broker.
 *
 * Flow:
 *   Workshop/Terminal  →  Distributor.distribute(deliverable)
 *                               ↓
 *                     validates the deliverable (via Workshop/Validator)
 *                               ↓
 *                     writes it to Refinery/Depot as a compiled product
 *                               ↓
 *                     Broadcast/Broker picks it up on next runOnce() poll
 *
 * The Distributor does NOT call the Broker directly — the Broker polls on its
 * own schedule (every 5 min via tasks/index.js) and the Depot is the durable
 * handoff point between the two departments.
 */

import { log } from '../core/log.js';
import { safeRun } from '../core/errors.js';
import createDepotAdapter from '../Refinery/Depot/depot.js';

const _depot = createDepotAdapter();

/**
 * Accept a deliverable from Workshop/Terminal, validate it, and write it to
 * the Depot so the Broker pipeline can process it.
 *
 * @param {object} deliverable  Validated Workshop deliverable
 * @param {{ skipValidation?: boolean }} [opts]
 * @returns {Promise<{ success: boolean, productId?: string, error?: string }>}
 */
export async function distribute(deliverable, opts = {}) {
  if (!deliverable || typeof deliverable !== 'object') {
    return { success: false, error: 'DISTRIBUTOR_INVALID_DELIVERABLE' };
  }

  // ── Optional validation via Workshop/Validator ─────────────────────────────
  if (!opts.skipValidation) {
    const validated = await safeRun(async () => {
      const { default: createValidator } = await import('../Workshop/Validator/Validator.js');
      const validator = createValidator();
      return validator.validate(deliverable);
    }, 'distributor:validate');
    if (validated && !validated.valid) {
      log.warn(`[Distributor] deliverable failed validation: ${validated.reason || 'unknown'}`);
      return { success: false, error: 'DISTRIBUTOR_VALIDATION_FAILED', reason: validated.reason };
    }
  }

  // ── Write to Depot ─────────────────────────────────────────────────────────
  const product = {
    id:               deliverable.id      || `dist:${Date.now()}`,
    version:          deliverable.version || new Date().toISOString(),
    type:             deliverable.type    || 'deliverable',
    shouldBroadcast:  deliverable.shouldBroadcast ?? true,
    recipients:       deliverable.recipients ?? {},
    payload:          deliverable,
    distributedAt:    new Date().toISOString(),
  };

  const result = await safeRun(() => _depot.put(product), 'distributor:depot-put');
  if (!result?.success) {
    return { success: false, error: 'DISTRIBUTOR_DEPOT_WRITE_FAILED' };
  }

  log.info(`[Distributor] product ${product.id} queued for Broker at ${product.distributedAt}`);
  return { success: true, productId: product.id };
}

/**
 * Batch-distribute multiple deliverables.
 *
 * @param {object[]} deliverables
 * @returns {Promise<{ success: boolean, results: object[] }>}
 */
export async function distributeBatch(deliverables) {
  const results = [];
  for (const d of deliverables) {
    results.push(await distribute(d));
  }
  return { success: true, results };
}
