/**
 * Distribution Delivery
 * Formats approved deliverables into Discord response payloads.
 */
'use strict';

function truncate(str, max = 1024) {
  if (!str) return '';
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max - 3) + '...';
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatProfile(data) {
  if (!data) return { content: 'No profile data returned.', ephemeral: true };

  const name   = data.trainer_name || data.name || 'Unknown Trainer';
  const id     = data.viewer_id || data.trainer_id || data.account_id || '—';
  const fans   = typeof data.fans === 'number' ? data.fans.toLocaleString() : '—';
  const rank   = data.rank != null ? `#${data.rank}` : '—';
  const circle = data.circle_name || data.circle || '—';

  return {
    embeds: [{
      title:  `Trainer Profile — ${name}`,
      color:  0x5865f2,
      fields: [
        { name: 'Viewer ID', value: String(id),     inline: true },
        { name: 'Fans',      value: fans,            inline: true },
        { name: 'Rank',      value: rank,            inline: true },
        { name: 'Circle',    value: String(circle),  inline: true },
      ],
      footer:    { text: 'uma.moe profile' },
      timestamp: new Date().toISOString(),
    }],
  };
}

function formatCircle(data) {
  if (!data) return { content: 'No circle data returned.', ephemeral: true };

  const circle      = data.circle || data;
  const name        = circle.name || circle.circle_name || 'Unknown Circle';
  const id          = circle.circle_id || '—';
  const memberCount = Array.isArray(data.members) ? data.members.length : (circle.member_count ?? '—');
  const totalFans   = typeof circle.total_fans === 'number' ? circle.total_fans.toLocaleString() : '—';

  return {
    embeds: [{
      title:  `Circle — ${name}`,
      color:  0x1abc9c,
      fields: [
        { name: 'Circle ID', value: String(id),          inline: true },
        { name: 'Members',   value: String(memberCount), inline: true },
        { name: 'Total Fans', value: String(totalFans),  inline: true },
      ],
      footer:    { text: 'uma.moe circle report' },
      timestamp: new Date().toISOString(),
    }],
  };
}

function formatFanGain(data) {
  if (!data) return { content: 'No fan gain data returned.', ephemeral: true };

  const entries = Array.isArray(data) ? data : (data.rankings || data.results || [data]);
  const lines   = entries.slice(0, 10).map((entry, i) => {
    const name = entry.trainer_name || `Viewer ${entry.viewer_id}`;
    const gain = typeof entry.gain === 'number' ? `+${entry.gain.toLocaleString()}` : '—';
    return `**${i + 1}.** ${name} — ${gain} fans`;
  });

  return {
    embeds: [{
      title:       'Fan Gain Rankings',
      description: lines.join('\n') || 'No data available.',
      color:       0xf1c40f,
      footer:      { text: 'uma.moe fan gain report' },
      timestamp:   new Date().toISOString(),
    }],
  };
}

function formatMemberList(data) {
  if (!data) return { content: 'No member data returned.', ephemeral: true };

  const circle      = data.circle || {};
  const name        = circle.name || 'Unknown Circle';
  const circleId    = circle.circle_id || '—';
  const members     = Array.isArray(data.members) ? data.members : [];

  if (members.length === 0) {
    return {
      content:   `No active members found for circle **${name}**.`,
      ephemeral: true,
    };
  }

  const topMembers = members.slice(0, 10);
  const lines = topMembers.map((member, i) => {
    const mName     = member.trainer_name || `Viewer ${member.viewer_id}`;
    const dailyFans = Array.isArray(member.daily_fans)
      ? member.daily_fans[member.daily_fans.length - 1]
      : null;
    const fansText  = dailyFans != null
      ? `${Number(dailyFans).toLocaleString()} fans`
      : 'fans unavailable';
    return `**${i + 1}.** ${mName} — ${fansText}`;
  });

  const fields = [
    { name: 'Total Members', value: String(members.length), inline: true },
    { name: 'Circle ID',     value: String(circleId),       inline: true },
  ];

  if (members.length > topMembers.length) {
    fields.push({
      name:  'Note',
      value: `Showing first ${topMembers.length} of ${members.length} members.`,
    });
  }

  return {
    embeds: [{
      title:       `Circle Member List — ${name} (${circleId})`,
      description: lines.join('\n'),
      color:       0x1abc9c,
      fields,
      footer:      { text: 'uma.moe circle member report' },
      timestamp:   new Date().toISOString(),
    }],
  };
}

function formatLink(data) {
  return {
    embeds: [{
      title:       'Account Linked',
      description: `Discord user <@${data.discordId}> has been linked to trainer \`${data.trainerId}\`.`,
      color:       0x2ecc71,
      footer:      { text: 'uma.moe link' },
      timestamp:   new Date().toISOString(),
    }],
  };
}

function formatSetFans(data) {
  return {
    embeds: [{
      title:       'Fan Count Registered',
      description: `Fan count set to **${Number(data.fanCount).toLocaleString()}** fans.`,
      color:       0x3498db,
      footer:      { text: 'uma.moe set_fans' },
      timestamp:   new Date().toISOString(),
    }],
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

function formatDiscordResponse({ product, command }) {
  if (!product || product.success === false) {
    const msg = product?.message || 'No data available. Please try again later.';
    return { content: truncate(msg, 2000), ephemeral: true };
  }

  const data = product.data || product;

  switch (command) {
    case 'profile':    return formatProfile(data);
    case 'circle':     return formatCircle(data);
    case 'fan_gain':   return formatFanGain(data);
    case 'memberlist': return formatMemberList(data);
    case 'link':       return formatLink(data);
    case 'set_fans':   return formatSetFans(data);
    default:
      return { content: truncate(JSON.stringify(data, null, 2), 1990) };
  }
}

module.exports = { formatDiscordResponse };
