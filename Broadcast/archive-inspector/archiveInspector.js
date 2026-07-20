// @ts-check
/**
 * Broadcast/archive-inspector/archiveInspector.js
 * ──────────────────────────────────────────────────
 * Department orchestrator for Broadcast/Inspector (envelope-pipeline side).
 *
 * Performs: eligibility check → dedup → recipient resolution → variant
 * selection → write to Archive.
 *
 * Domain eligibility is delegated to the assimilated Inspector department files:
 *   ../Inspector/milestoneTiers.js  — TIERS definitions
 *   ../Inspector/milestoneWinners.js — selectSpecialWinners
 *   ../Inspector/warningInspector.js — warning engine checks
 *
 * Milestone threshold evaluation uses:
 *   ../../Refinery/Refiner/milestoneEval.js — meetsThreshold()
 */

import Archive from '../Archive/archive.js';
import { log } from '../../core/log.js';
import { safeRun } from '../../core/errors.js';
import { meetsThreshold } from '../../Refinery/Refiner/milestoneEval.js';

export default class ArchiveInspector {
  constructor({ archive } = {}) {
    this.archive = archive || new Archive();
  }

  // ── Eligibility ─────────────────────────────────────────────────────────────

  /**
   * Determine if a compiled product is eligible for broadcast.
   * Checks standard flags first, then milestone threshold if applicable.
   */
  _isEligible(product) {
    if (!product) return false;
    // Explicit broadcast flag
    if (product.shouldBroadcast === true) return true;
    // Milestone threshold check via domain evaluator
    if (typeof product.threshold === 'number' && typeof product.value === 'number') {
      return meetsThreshold(
        { monthlyGain: product.value },
        { threshold: product.threshold }
      );
    }
    // Trigger flag
    if (product.trigger === 'broadcast') return true;
    return false;
  }

  _makeNotificationKey(product) {
    if (product.notificationKey) return product.notificationKey;
    const id  = product.id || product.trainer_id || `p-${Date.now()}`;
    const ver = product.version || product.version_tag || Date.now();
    return `${String(id)}:${String(ver)}`;
  }

  _resolveRecipients(product) {
    const r = product.recipients || {};
    return {
      channel: r.channel || process.env.DEFAULT_BROADCAST_CHANNEL || null,
      members: r.members || [],
      leader:  r.leader  || null,
    };
  }

  _selectVariant(product) {
    if (product.variant) return product.variant;
    if (Array.isArray(product.variants) && product.variants.length) return product.variants[0];
    return { blueprint: 'default', messageTemplate: product.messageTemplate || null };
  }

  // ── Inspect ─────────────────────────────────────────────────────────────────

  /**
   * Inspect a compiled product: check eligibility, dedup, resolve recipients,
   * select variant, and write to Archive.
   *
   * @param {object} product  Compiled product from Refinery/Depot
   * @returns {Promise<{ success: boolean, notificationKey?: string, rejected?: boolean, reason?: string }>}
   */
  async inspect(product) {
    return safeRun(async () => {
      if (!this._isEligible(product)) {
        log.debug(`[ArchiveInspector] product ${product?.id} not eligible — skipping`);
        return { success: false, rejected: true, reason: 'NOT_ELIGIBLE' };
      }

      const notificationKey = this._makeNotificationKey(product);

      // Dedup: skip if an archive record already exists for this key
      const existing = await this.archive.getByKey(notificationKey);
      if (existing?.success) {
        log.debug(`[ArchiveInspector] duplicate key ${notificationKey} — skipping`);
        return { success: false, rejected: true, reason: 'DUPLICATE' };
      }

      const recipients = this._resolveRecipients(product);
      const variant    = this._selectVariant(product);

      const record = {
        notificationKey,
        createdFrom: product.id || null,
        payload:     product,
        deliveryPlan: {
          channel: recipients.channel,
          members: recipients.members,
          leader:  recipients.leader,
        },
        variant,
        metadata: { inspectedAt: new Date().toISOString() },
      };

      const ins = await this.archive.insert(record);
      log.info(`[ArchiveInspector] created archive record for ${notificationKey}`);
      return ins;
    }, `archive-inspector:${product?.id ?? '?'}`);
  }
}
