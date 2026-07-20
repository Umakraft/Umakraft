/**
 * Broadcast/Announcer/milestoneAnnouncer.js
 * ───────────────────────────────────────────
 * Delivers milestone notifications to Discord channels and DMs.
 * Image card construction delegated to Workshop/Fabricator/renders/milestone.js.
 * Notification state persisted in Broadcast/Archive/milestoneArchive.js.
 */

import { ensureGuildChannels } from '../../core/channels.js';
import { log } from '../../core/log.js';
import { formatNumber } from '../../core/format.js';
import { postUpdate } from '../../utils/updateLog.js';
import { dmByViewerId, dmLeader } from '../../utils/dm.js';
import { buildReportFilename, bufferToAttachment } from '../../utils/imageReport.js';
import { buildMilestonePayload } from '../../Workshop/Fabricator/renders/milestone.js';
import {
  markChannelSent,
  markDmMemberSent,
  markDmLeaderSent,
  saveMilestoneMessageId,
} from '../../Broadcast/Archive/milestoneArchive.js';

// Max channel posts per channel per cron run — prevents burst if many members
// hit a threshold in the same 30-minute window.
export const CHANNEL_NOTIFY_LIMIT = 5;

// ── Internal helpers ──────────────────────────────────────────────────────────

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Channel announcement ──────────────────────────────────────────────────────

/**
 * Send the milestone image to all guilds.
 * Returns { handled, sentMsg }.
 */
export async function sendChannelAnnouncement(guilds, tier, buffer, channelNotifyCount) {
  let handledByAtLeastOneGuild = false;
  let sentMsg                  = null;

  for (const [, partial] of guilds) {
    let guild;
    try { guild = await partial.fetch(); } catch { continue; }

    let channels;
    try { channels = await ensureGuildChannels(guild); } catch { continue; }

    const { announcement } = channels;
    if (!announcement) continue;

    const channelId = announcement.id;
    const sentSoFar = channelNotifyCount.get(channelId) ?? 0;

    if (sentSoFar >= CHANNEL_NOTIFY_LIMIT) {
      log.info(`milestoneAnnouncer: #${announcement.name} hit run cap (${CHANNEL_NOTIFY_LIMIT}) — skipping`);
      handledByAtLeastOneGuild = true;
      continue;
    }

    try {
      const attachment = bufferToAttachment(buffer, buildReportFilename('Milestone'));
      const payload    = { content: tier.special ? '@everyone' : undefined, files: [attachment] };
      const msg        = await announcement.send(payload);
      channelNotifyCount.set(channelId, sentSoFar + 1);
      handledByAtLeastOneGuild = true;
      if (!sentMsg) {
        sentMsg = { guildId: guild.id, channelId: announcement.id, msgId: msg.id };
      }
    } catch (err) {
      log.warn(`milestoneAnnouncer: channel send failed in ${guild.name}: ${err.message}`);
    }
  }

  return { handled: handledByAtLeastOneGuild, sentMsg };
}

// ── DM text builders ──────────────────────────────────────────────────────────

export function buildMemberDmText(member, tier, body, posLabel, circleName) {
  const header = tier.dmHeader ?? '🎉 **Milestone reached!**';
  return (
    `${header}\n\n` +
    `${body}\n\n` +
    `You've hit **${formatNumber(tier.threshold)} fans** this month in **${circleName}**!\n` +
    `**Current monthly gain:** ${formatNumber(member.monthlyGain)}\n` +
    `*You are the ${posLabel}!*`
  );
}

export function buildLeaderDmText(member, tier, position) {
  if (tier.special) {
    const label = formatNumber(tier.threshold);
    return (
      `${tier.embedTitle}\n\n` +
      `**${member.trainerName}** just secured a **Top (1–3) spot** with over **${label} fans** this month! 🏇✨\n` +
      `**Current monthly gain:** ${formatNumber(member.monthlyGain)}\n` +
      `*${ordinal(position)} member to reach ${label} this month.*`
    );
  }
  return (
    `📢 **Milestone alert!**\n\n` +
    `**${member.trainerName}** just hit **${formatNumber(tier.threshold)} fans** this month!\n` +
    `**Current monthly gain:** ${formatNumber(member.monthlyGain)}\n` +
    `*${ordinal(position)} member to reach this milestone.*`
  );
}

// ── Retry helper ──────────────────────────────────────────────────────────────

/**
 * Called when a milestone record exists but some sends are still pending.
 * Retries only the steps whose flag is still 0.
 */
export async function retrySends(
  client,
  guilds,
  member,
  tier,
  month,
  record,
  channelNotifyCount,
  nextImage,
  daysLeft,
  snapshot,
  circleId
) {
  const { position } = record;
  log.info(
    `milestoneAnnouncer: RETRY pending sends for ${member.trainerName}:${tier.key} ` +
    `(ch=${record.channel_sent} dm_m=${record.dm_member_sent} dm_l=${record.dm_leader_sent})`
  );

  let buffer   = null;
  let body     = null;
  let posLabel = null;

  const needsBuffer = !record.channel_sent;
  if (needsBuffer || !record.dm_member_sent) {
    const built = await buildMilestonePayload(member, tier, daysLeft, position, nextImage);
    buffer      = built.buffer;
    body        = built.body;
    posLabel    = built.posLabel;
  }

  if (!record.channel_sent) {
    const { handled: ok, sentMsg } = await sendChannelAnnouncement(
      guilds, tier, buffer, channelNotifyCount
    );
    if (ok) {
      markChannelSent(member.trainerId, tier.key, month, circleId);
      if (sentMsg) {
        saveMilestoneMessageId(
          member.trainerId, tier.key, month,
          sentMsg.guildId, sentMsg.channelId, sentMsg.msgId,
          circleId
        );
      }
      log.info(`milestoneAnnouncer: retry channel OK for ${member.trainerName}:${tier.key}`);
    }
  }

  if (!record.dm_member_sent) {
    if (!body) {
      const built = await buildMilestonePayload(member, tier, daysLeft, position, nextImage);
      body        = built.body;
      posLabel    = built.posLabel;
    }
    const ok = await dmByViewerId(
      client, member.trainerId,
      buildMemberDmText(member, tier, body, posLabel, snapshot.circle.name)
    );
    if (ok) markDmMemberSent(member.trainerId, tier.key, month, circleId);
  }

  if (!record.dm_leader_sent) {
    const ok = await dmLeader(client, snapshot, buildLeaderDmText(member, tier, position));
    if (ok) markDmLeaderSent(member.trainerId, tier.key, month, circleId);
  }
}

// ── re-exports for convenience ────────────────────────────────────────────────
export { postUpdate };
export { buildMilestonePayload } from '../../Workshop/Fabricator/renders/milestone.js';
