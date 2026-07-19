/**
 * Workshop/Fabricator/renders/warningReport.js
 * ──────────────────────────────────────────────
 * Re-exports deficit render functions as Workshop/Fabricator owned renders.
 * The actual render implementations live in Workshop/Fabricator/reports/fanDeficit.js.
 * Broadcast/Announcer imports from here — not from the report file directly.
 */

export {
  renderDailyDeficitReport,
  renderWeeklyDeficitReport,
  renderMonthlyDeficitReport,
} from '../reports/fanDeficit.js';
