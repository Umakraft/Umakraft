// @ts-check
/**
 * Broadcast/Broker/broker.js
 * ───────────────────────────
 * Department orchestrator for Broadcast/Broker.
 *
 * The Broker is the entry point for the envelope-based notification pipeline:
 *   1. On each `runOnce()` call it polls Refinery/Depot for new compiled products.
 *   2. New products are handed to ArchiveInspector for eligibility checking + dedup.
 *   3. Accepted records go to ArchiveTransporter for delivery via Announcer.
 *   4. Restart-recovery: incomplete archive records are retried first.
 *
 * Domain broker files (assimilated cron-based delivery functions):
 *   ./milestoneBroker.js          — monthly fan milestone announcements
 *   ./greetingBroker.js           — daily greeting reports
 *   ./dailyMessageBroker.js       — daily per-member DM messages
 *   ./offlineCheckBroker.js       — offline member alerts
 *   ./weeklyAnnouncementBroker.js — weekly leaderboard + help posts
 *   ./interCircleBroker.js        — inter-circle leaderboard announcements
 */

import { log } from '../../core/log.js';
import { safeRun } from '../../core/errors.js';

// ── Domain file re-exports ────────────────────────────────────────────────────
export { checkMilestones }                            from './milestoneBroker.js';
export { postDailyGreetingReport, sendPerUserGreetings } from './greetingBroker.js';
export { checkAndSendGreetings }                      from './dailyMessageBroker.js';
export { checkOfflineMembers }                        from './offlineCheckBroker.js';
export { postWeeklyLeaderboard, postWeeklyHelp }      from './weeklyAnnouncementBroker.js';
export *                                              from './interCircleBroker.js';

// ── Envelope-pipeline Broker class ───────────────────────────────────────────

export default class Broker {
  constructor({ archiveInspector, archiveTransporter, archive } = {}) {
    this.archiveInspector   = archiveInspector   || null;
    this.archiveTransporter = archiveTransporter || null;
    this.archive            = archive            || null;
  }

  async _lazyLoad() {
    if (!this.archive) {
      const mod = await import('../Archive/archive.js');
      this.archive = new (mod.default)();
    }
    if (!this.archiveInspector) {
      const ia = await import('../archive-inspector/archiveInspector.js');
      this.archiveInspector = new (ia.default)({ archive: this.archive });
    }
    if (!this.archiveTransporter) {
      const at  = await import('../archive_transporter/archiveTransporter.js');
      const Ann = await import('../Announcer/announcer.js');
      const announcer = new (Ann.default)({ archive: this.archive });
      this.archiveTransporter = new (at.default)({ archive: this.archive, announcer });
    }
  }

  async _loadDepot() {
    try {
      const mod = await import('../../Refinery/Depot/depot.js');
      const candidate = mod?.default || mod;
      if (candidate && typeof candidate.query === 'function') return candidate;
      if (typeof candidate === 'function') {
        const inst = candidate();
        if (inst && typeof inst.query === 'function') return inst;
        return inst;
      }
    } catch (err) {
      log.warn(`[Broker] _loadDepot failed: ${err.message}`);
    }
    return null;
  }

  async runOnce() {
    await this._lazyLoad();

    // 1) Recovery: retry incomplete archive records
    const incomplete = await safeRun(() => this.archive.queryIncomplete(), 'broker:queryIncomplete');
    if (incomplete?.success && Array.isArray(incomplete.data)) {
      for (const rec of incomplete.data) {
        await safeRun(
          () => this.archiveTransporter.transport(rec.notificationKey),
          `broker:recovery:${rec.notificationKey}`
        );
      }
    }

    // 2) Poll Depot for new compiled products → Inspector → Transporter
    await safeRun(async () => {
      const depot    = await this._loadDepot();
      if (!depot) return;
      const q        = await depot.query({});
      const products = q?.results ?? [];
      for (const p of products) {
        await safeRun(async () => {
          const res = await this.archiveInspector.inspect(p);
          if (res?.success) {
            await this.archiveTransporter.transport(res.notificationKey);
          }
        }, `broker:inspect:${p?.id ?? '?'}`);
      }
    }, 'broker:depotPoll');

    return { success: true };
  }
}
