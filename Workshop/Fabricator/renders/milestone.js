/**
 * Workshop/Fabricator/renders/milestone.js
 * ──────────────────────────────────────────
 * Pure render helper for milestone deliverables.
 * Owns: image card construction (buildMilestonePayload).
 * Does NOT send to Discord — that is Broadcast/Announcer's responsibility.
 */

import fs from 'node:fs/promises';
import { renderMilestone, bufferToAttachment, buildReportFilename } from '../../../utils/imageReport.js';
import { formatNumber } from '../../../core/format.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

// ── Payload builder ───────────────────────────────────────────────────────────

/**
 * Build a milestone image card and compose the message text.
 *
 * @param {object}   member
 * @param {object}   tier
 * @param {number}   daysLeft
 * @param {number}   position
 * @param {Function} nextImage  — () => string  (image path selector)
 * @returns {Promise<{ buffer: Buffer, body: string, posLabel: string }>}
 */
export async function buildMilestonePayload(member, tier, daysLeft, position, nextImage) {
  const mainMsg  = Array.isArray(tier.main)
    ? tier.main[Math.floor(Math.random() * tier.main.length)]
    : tier.main;
  const body     = tier.urgent && daysLeft <= tier.urgentDays ? tier.urgent : mainMsg;
  const posLabel = `${ordinal(position)} member to hit ${formatNumber(tier.threshold)} fans this month`;

  const imagePath =
    tier.dedicatedImage ??
    (tier.imagePool
      ? tier.imagePool[Math.floor(Math.random() * tier.imagePool.length)]
      : nextImage());
  const hasImage = await fileExists(imagePath);

  const buffer = await renderMilestone({
    trainerName:    member.trainerName,
    thresholdLabel: formatNumber(tier.threshold),
    monthlyGain:    formatNumber(member.monthlyGain),
    posLabel,
    message:        body,
    imagePath:      hasImage ? imagePath : null,
    isSpecial:      !!tier.special,
    theme:          tier.theme ?? null,
    circleName:     '',
  });

  return { buffer, body, posLabel };
}

// Re-export attachment helpers so Announcer can use them without reaching into imageReport
export { bufferToAttachment, buildReportFilename };
