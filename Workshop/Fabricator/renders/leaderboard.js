/**
 * Workshop/Fabricator/renders/leaderboard.js
 * ────────────────────────────────────────────
 * Pure render helpers for leaderboard deliverables.
 * Owns: row building, DM message templates, display constants.
 * Does NOT send to Discord — that is Broadcast/Announcer's responsibility.
 */

import { formatNumber } from '../../../core/format.js';

export const MEDALS  = ['🥇', '🥈', '🥉'];
export const MAX_ROWS = 10;

// ── DM message templates ──────────────────────────────────────────────────────

export function dailyDmMsg(_trainerName, rank) {
  return (
    `🏆 **Daily Leaderboard Message**\n\n` +
    `Congratulations, Trainer-san!\n\nI'm Smart Falcon 🏇✨\n\n` +
    `You've placed **${MEDALS[rank - 1]} #${rank}** on today's leaderboard! ` +
    `Your hard work really paid off today — let's keep this momentum going!\n\n— Smart Falcon`
  );
}

export function weeklyDmMsg(_trainerName, rank) {
  return (
    `📊 **Weekly Leaderboard Message**\n\n` +
    `Amazing work this week, Trainer-san!\n\nI'm Smart Falcon 🏇✨\n\n` +
    `You've secured **${MEDALS[rank - 1]} #${rank}** on the weekly leaderboard! ` +
    `Your consistency and dedication are really showing. Thank you for your continued support!\n\n— Smart Falcon`
  );
}

export function monthlyDmMsg(_trainerName, rank) {
  return (
    `🌟 **Monthly Leaderboard Message**\n\n` +
    `Outstanding performance, Trainer-san!\n\nI'm Smart Falcon 🏇✨\n\n` +
    `You're **${MEDALS[rank - 1]} #${rank}** on the monthly leaderboard! ` +
    `That's a huge achievement and proof of your long-term dedication.\n\n— Smart Falcon`
  );
}

// ── Row builder ───────────────────────────────────────────────────────────────

/**
 * Build display rows for a leaderboard render.
 * @param {object[]} sorted    — members sorted by gainFn descending
 * @param {Function} gainFn    — (member) => number
 * @param {number}   quota     — circle quota for the period
 * @param {boolean}  _tallyStarted
 * @returns {object[]}
 */
export function buildRows(sorted, gainFn, quota, _tallyStarted) {
  return sorted.slice(0, MAX_ROWS).map((m, i) => {
    const gainRaw = gainFn(m);
    const gapRaw  = gainRaw - quota;
    const pct     = quota > 0 ? Math.min(200, Math.round((gainRaw / quota) * 100)) : 0;
    return {
      rank: i + 1,
      name: m.trainerName,
      gainRaw,
      gainStr: formatNumber(gainRaw),
      gapRaw,
      gapStr: (gapRaw >= 0 ? '+' : '') + formatNumber(Math.abs(gapRaw)),
      pct,
    };
  });
}
