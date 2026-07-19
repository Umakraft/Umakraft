/**
 * Broadcast/Announcer/leaderboardAnnouncer.js
 * ─────────────────────────────────────────────
 * Delivers leaderboard announcements to Discord channels and top-3 DMs.
 * Render helpers (buildRows, DM templates) sourced from Workshop/Fabricator.
 * Archive/dedup state managed via core/store.
 */

import { getCircleSnapshot } from '../../core/uma.js';
import { getLeaderboardChannel } from '../../core/channels.js';
import { formatNumber, jstDate } from '../../core/format.js';
import { config } from '../../core/config.js';
import { resolveQuota } from '../../core/quotaKeys.js';
import { store } from '../../core/store.js';
import { dmByViewerId } from '../../utils/dm.js';
import { log } from '../../core/log.js';
import { isLocked } from '../../core/busyLock.js';
import { postUpdate } from '../../utils/updateLog.js';
import { renderLeaderboard, bufferToAttachment, buildReportFilename } from '../../utils/imageReport.js';
import {
  buildRows,
  dailyDmMsg,
  weeklyDmMsg,
  monthlyDmMsg,
  MAX_ROWS,
} from '../../Workshop/Fabricator/renders/leaderboard.js';

// ── Channel delivery ──────────────────────────────────────────────────────────

async function sendToLeaderboardChannel(client, bufferFactory, filename, msgStoreKey) {
  const guilds = await client.guilds.fetch();
  for (const [, partial] of guilds) {
    try {
      const guild   = await partial.fetch();
      const channel = await getLeaderboardChannel(guild);
      if (!channel) continue;

      const guildConfig = await store.getGuildConfig(guild.id);
      const prevMsgId   = guildConfig[msgStoreKey];
      if (prevMsgId) {
        try {
          const prev = await channel.messages.fetch(prevMsgId);
          await prev.delete();
        } catch { /* already gone */ }
      }

      const imageBuffer = await bufferFactory(guildConfig);
      const msg = await channel.send({ files: [bufferToAttachment(imageBuffer, filename)] });
      await store.setGuildConfig(guild.id, { [msgStoreKey]: msg.id });
    } catch (err) {
      log.warn(`leaderboardAnnouncer: ${partial.name ?? partial.id}: ${err.message}`);
    }
  }
}

// ── DM top-3 ─────────────────────────────────────────────────────────────────

async function dmTop3(client, top3, dmFn) {
  for (let i = 0; i < Math.min(top3.length, 3); i++) {
    const m = top3[i];
    await dmByViewerId(client, m.trainerId, dmFn(m.trainerName, i + 1));
  }
}

// ── Daily ─────────────────────────────────────────────────────────────────────

export async function postDailyTop3(client, circleId) {
  if (isLocked()) {
    log.info('leaderboard: skipped — notification lock held');
    return;
  }

  const today     = jstDate();
  const stateKey  = `lastDailyLbDate_${circleId}`;
  const lastPosted = await store.getState(stateKey).catch(() => null);
  if (lastPosted === today) {
    log.info(`leaderboard(daily,${circleId}): already posted today — skipping`);
    return;
  }

  let snapshot;
  try {
    snapshot = await getCircleSnapshot(circleId);
  } catch (err) {
    log.warn('leaderboardAnnouncer(daily):', err.message);
    return;
  }

  const tallyStarted = snapshot.members.some(m => m.hasData);
  const eligible     = snapshot.members.filter(m => m.hasData && !m.joinDay);
  const sorted       = [...eligible]
    .filter(m => m.yesterdayGain >= 1_000_000)
    .sort((a, b) => b.yesterdayGain - a.yesterdayGain);
  if (sorted.length === 0) return;

  await sendToLeaderboardChannel(
    client,
    async (cfg) => {
      const quota = resolveQuota(cfg, circleId, 'daily', config.dailyRequirement);
      return renderLeaderboard({
        circleName:   snapshot.circle.name,
        scope:        'Daily',
        date:         today,
        totalMembers: snapshot.members.length,
        quotaLabel:   formatNumber(quota),
        rows:         buildRows(sorted, m => m.yesterdayGain, quota, tallyStarted),
      });
    },
    buildReportFilename('LeaderboardDaily'),
    `lbMsgDaily_${circleId}`
  );
  await dmTop3(client, sorted, dailyDmMsg);
  await store.setState(stateKey, today).catch(() => {});
  await postUpdate(
    client, '🏆', 'Daily leaderboard posted',
    `Top ${Math.min(sorted.length, MAX_ROWS)} trainers · ${today}`
  ).catch(() => {});
  log.info(`leaderboardAnnouncer: posted daily leaderboard (${circleId})`);
}

// ── Weekly ────────────────────────────────────────────────────────────────────

export async function postWeeklyTop3(client, circleId) {
  if (isLocked()) {
    log.info('leaderboard: skipped — notification lock held');
    return;
  }

  const today     = jstDate();
  const stateKey  = `lastWeeklyLbDate_${circleId}`;
  const lastPosted = await store.getState(stateKey).catch(() => null);
  if (lastPosted === today) {
    log.info(`leaderboard(weekly,${circleId}): already posted today — skipping`);
    return;
  }

  let snapshot;
  try {
    snapshot = await getCircleSnapshot(circleId);
  } catch (err) {
    log.warn('leaderboardAnnouncer(weekly):', err.message);
    return;
  }

  const tallyStarted = snapshot.members.some(m => m.hasData);
  const eligible     = snapshot.members.filter(m => m.hasData && !m.joinDay);
  const sorted       = [...eligible]
    .filter(m => m.weeklyGain >= 1_000_000)
    .sort((a, b) => b.weeklyGain - a.weeklyGain);
  if (sorted.length === 0) return;

  await sendToLeaderboardChannel(
    client,
    async (cfg) => {
      const quota = resolveQuota(cfg, circleId, 'weekly', config.weeklyRequirement);
      return renderLeaderboard({
        circleName:   snapshot.circle.name,
        scope:        'Weekly',
        date:         `Week ending ${today}`,
        totalMembers: snapshot.members.length,
        quotaLabel:   formatNumber(quota),
        rows:         buildRows(sorted, m => m.weeklyGain, quota, tallyStarted),
      });
    },
    buildReportFilename('LeaderboardWeekly'),
    `lbMsgWeekly_${circleId}`
  );
  await dmTop3(client, sorted, weeklyDmMsg);
  await store.setState(stateKey, today).catch(() => {});
  await postUpdate(
    client, '📊', 'Weekly leaderboard posted',
    `Top ${Math.min(sorted.length, MAX_ROWS)} trainers · week ending ${today}`
  ).catch(() => {});
  log.info(`leaderboardAnnouncer: posted weekly leaderboard (${circleId})`);
}

// ── Monthly ───────────────────────────────────────────────────────────────────

export async function postMonthlyTop3(client, circleId) {
  if (isLocked()) {
    log.info('leaderboard: skipped — notification lock held');
    return;
  }

  const today     = jstDate();
  const stateKey  = `lastMonthlyLbDate_${circleId}`;
  const lastPosted = await store.getState(stateKey).catch(() => null);
  if (lastPosted === today) {
    log.info(`leaderboard(monthly,${circleId}): already posted today — skipping`);
    return;
  }

  let snapshot;
  try {
    snapshot = await getCircleSnapshot(circleId);
  } catch (err) {
    log.warn('leaderboardAnnouncer(monthly):', err.message);
    return;
  }

  const tallyStarted = snapshot.members.some(m => m.hasData);
  const eligible     = snapshot.members.filter(m => m.hasData && !m.joinDay);
  const sorted       = [...eligible].sort((a, b) => b.monthlyGain - a.monthlyGain);
  if (sorted.length === 0) return;

  await sendToLeaderboardChannel(
    client,
    async (cfg) => {
      const quota = resolveQuota(cfg, circleId, 'monthly', config.monthlyRequirement);
      return renderLeaderboard({
        circleName:   snapshot.circle.name,
        scope:        'Monthly',
        date:         today,
        totalMembers: snapshot.members.length,
        quotaLabel:   formatNumber(quota),
        rows:         buildRows(sorted, m => m.monthlyGain, quota, tallyStarted),
      });
    },
    buildReportFilename('LeaderboardMonthly'),
    `lbMsgMonthly_${circleId}`
  );
  await dmTop3(client, sorted, monthlyDmMsg);
  await store.setState(stateKey, today).catch(() => {});
  await postUpdate(
    client, '🌟', 'Monthly leaderboard posted',
    `${sorted.length} trainers ranked · ${today}`
  ).catch(() => {});
  log.info(`leaderboardAnnouncer: posted monthly leaderboard (${circleId})`);
}
