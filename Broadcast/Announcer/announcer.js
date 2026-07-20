// @ts-check
/**
 * Broadcast/Announcer/announcer.js
 * ──────────────────────────────────
 * Department orchestrator for Broadcast/Announcer.
 *
 * The Announcer is the final delivery stage in the envelope-based notification
 * pipeline. It receives archive records from the ArchiveTransporter and:
 *   — posts image cards / embeds to Discord channels
 *   — DMs linked members
 *   — DMs the circle leader
 *   — records delivery flags in the Archive for idempotency
 *
 * Domain announcer files (assimilated cron-based delivery functions):
 *   ./leaderboardAnnouncer.js  — daily/weekly/monthly leaderboard posts
 *   ./milestoneAnnouncer.js    — milestone channel + DM delivery
 *   ./fanDeficitAnnouncer.js   — fan deficit image report delivery
 */

import Archive from '../Archive/archive.js';
import { log } from '../../core/log.js';
import { safeRun } from '../../core/errors.js';

// ── Domain file re-exports ────────────────────────────────────────────────────
export { postDailyTop3, postWeeklyTop3, postMonthlyTop3 } from './leaderboardAnnouncer.js';
export {
  sendChannelAnnouncement,
  buildMemberDmText,
  buildLeaderDmText,
  retrySends,
  postUpdate,
  CHANNEL_NOTIFY_LIMIT,
} from './milestoneAnnouncer.js';
export { postFanDeficitImageReport } from './fanDeficitAnnouncer.js';

// ── Envelope-pipeline Announcer class ────────────────────────────────────────

export default class Announcer {
  constructor({ archive, client } = {}) {
    this.archive = archive || new Archive();
    this.client  = client  || null;
  }

  /**
   * Deliver a notification record fetched from the Archive.
   * Steps: channel post → member DMs → leader DM.
   * Each step is marked in deliveryFlags immediately on success.
   *
   * @param {object} record  Archive record with deliveryPlan and deliveryFlags
   * @returns {Promise<{ success: boolean }>}
   */
  async deliver(record) {
    if (!record?.notificationKey) return { success: false, error: 'INVALID_RECORD' };

    const notifKey = record.notificationKey;
    const flags    = (record.deliveryFlags ||= { channel_sent: 0, dm_member_sent: 0, dm_leader_sent: 0 });

    // ── Channel post ──────────────────────────────────────────────────────────
    if (flags.channel_sent === 0) {
      try {
        const channelId = record.deliveryPlan?.channel;
        if (channelId && this.client) {
          const ch = await safeRun(
            () => this.client.channels.fetch(channelId),
            `announcer:fetch-channel:${channelId}`
          );
          if (ch?.send) {
            const embed = this._buildEmbed(record);
            await ch.send({ embeds: [embed] });
            log.info(`[Announcer] channel post delivered for ${notifKey}`);
          } else {
            log.warn(`[Announcer] channel ${channelId} missing or not sendable`);
          }
        } else if (channelId) {
          log.warn(`[Announcer] no Discord client — cannot post to channel ${channelId}`);
        }
        await this.archive.updateFlags(notifKey, { channel_sent: 1 });
        await this.archive.appendHistory(notifKey, { step: 'channel_post', result: 'ok' });
      } catch (err) {
        await this.archive.appendHistory(notifKey, { step: 'channel_post', result: 'error', message: err.message });
        return { success: false, error: 'CHANNEL_POST_FAILED', message: err.message };
      }
    }

    // ── Member DMs ────────────────────────────────────────────────────────────
    if (flags.dm_member_sent === 0) {
      const members = record.deliveryPlan?.members ?? [];
      try {
        for (const userId of members) {
          await safeRun(async () => {
            if (this.client) {
              const user = await this.client.users.fetch(userId).catch(() => null);
              if (user?.send) {
                await user.send(record.variant?.messageTemplate ?? `Notification: ${notifKey}`);
              }
            } else {
              log.info(`[Announcer] no client — skipping DM to member ${userId}`);
            }
          }, `announcer:dm-member:${userId}`);
        }
        await this.archive.updateFlags(notifKey, { dm_member_sent: 1 });
        await this.archive.appendHistory(notifKey, { step: 'dm_members', result: 'ok', count: members.length });
      } catch (err) {
        await this.archive.appendHistory(notifKey, { step: 'dm_members', result: 'error', message: err.message });
        return { success: false, error: 'DM_MEMBERS_FAILED', message: err.message };
      }
    }

    // ── Leader DM ─────────────────────────────────────────────────────────────
    if (flags.dm_leader_sent === 0) {
      const leader = record.deliveryPlan?.leader ?? null;
      try {
        if (leader && this.client) {
          await safeRun(async () => {
            const user = await this.client.users.fetch(leader).catch(() => null);
            if (user?.send) {
              await user.send(record.variant?.leaderTemplate ?? `Leader notification: ${notifKey}`);
              log.info(`[Announcer] leader DM delivered for ${notifKey}`);
            }
          }, `announcer:dm-leader:${leader}`);
        } else if (leader) {
          log.info(`[Announcer] no client — skipping leader DM for ${notifKey}`);
        }
        await this.archive.updateFlags(notifKey, { dm_leader_sent: 1 });
        await this.archive.appendHistory(notifKey, { step: 'dm_leader', result: 'ok', leader: leader ?? null });
      } catch (err) {
        await this.archive.appendHistory(notifKey, { step: 'dm_leader', result: 'error', message: err.message });
        return { success: false, error: 'DM_LEADER_FAILED', message: err.message };
      }
    }

    return { success: true };
  }

  _buildEmbed(record) {
    return {
      title:       record.payload?.title       || 'Notification',
      description: record.payload?.description || record.variant?.messageTemplate || '',
      fields:      [],
    };
  }
}
