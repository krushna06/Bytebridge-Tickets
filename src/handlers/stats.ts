import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { createOrUpdateProfile, getProfile, getLeaderboard, countTicketsByGuild, countOpenTicketsByGuild, listTicketsForGuild, getGuildSettings } from '../lib/database';
import { Ctx, makeEmbed, isStaffFromSettings } from './common';

function isStaffUser(userId: string, guildId: string, client: any): boolean {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return false;
    
    const member = guild.members.cache.get(userId);
    if (!member) return false;
    
    const settings = getGuildSettings(guildId);
    return isStaffFromSettings(member, settings);
  } catch (e) {
    return false;
  }
}

export const leaderboard = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const sortBy = interaction.options.getString('sort') || 'resolved';
  const limit = interaction.options.getInteger('limit') || 10;
  const guildId = interaction.guildId!;

  const db = require('../lib/database').default;
  const settings = getGuildSettings(guildId);

  let query = '';
  let title = '';

  switch (sortBy) {
    case 'resolved':
      query = `
        SELECT ss.userId, ss.closedCount as value
        FROM staff_stats ss
        WHERE ss.guildId = ?
        ORDER BY ss.closedCount DESC
        LIMIT ?
      `;
      title = 'Leaderboard - Total Tickets Resolved';
      break;
    case 'response':
      query = `
        SELECT tm.claimedBy as userId, AVG(t.closedAt - t.createdAt) as value
        FROM tickets t
        INNER JOIN ticket_meta tm ON t.id = tm.ticketId
        WHERE t.guildId = ? AND t.closedAt IS NOT NULL AND tm.claimedBy IS NOT NULL
        GROUP BY tm.claimedBy
        ORDER BY value ASC
        LIMIT ?
      `;
      title = 'Leaderboard - Avg Response Time (Lower is Better)';
      break;
    case 'resolve':
      query = `
        SELECT t.closedBy as userId, AVG(t.closedAt - t.createdAt) as value
        FROM tickets t
        WHERE t.guildId = ? AND t.closedAt IS NOT NULL AND t.closedBy IS NOT NULL
        GROUP BY t.closedBy
        ORDER BY value ASC
        LIMIT ?
      `;
      title = 'Leaderboard - Avg Resolve Time (Lower is Better)';
      break;
    case 'feedback':
      query = `
        SELECT tf.handledBy as userId, AVG(tf.score) as value
        FROM ticket_feedback tf
        WHERE tf.guildId = ?
        GROUP BY tf.handledBy
        ORDER BY value DESC
        LIMIT ?
      `;
      title = 'Leaderboard - Avg Feedback Score';
      break;
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(guildId, limit) as any[];

  const staffRows = rows.filter(r => isStaffUser(r.userId, guildId, ctx.client));

  if (!staffRows.length) {
    return interaction.editReply({ embeds: [makeEmbed('No stats yet.', undefined, guildId)] });
  }

  let out = '';
  if (sortBy === 'feedback') {
    out = staffRows.map((r: any, i: number) => `${i + 1}. <@${r.userId}> - ${(r.value || 0).toFixed(1)}/5`).join('\n');
  } else if (sortBy === 'response' || sortBy === 'resolve') {
    out = staffRows.map((r: any, i: number) => `${i + 1}. <@${r.userId}> - ${formatMs(r.value)}`).join('\n');
  } else {
    out = staffRows.map((r: any, i: number) => `${i + 1}. <@${r.userId}> - ${r.value || 0} tickets`).join('\n');
  }

  return interaction.editReply({ embeds: [makeEmbed(`${title}\n\n${out}`, undefined, guildId)] });
};

export const setprofile = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to set profiles.', undefined, interaction.guildId || undefined)] });
  const display = interaction.options.getString('display') || interaction.options.getString('name') || undefined;
  const bio = interaction.options.getString('bio') || undefined;
  createOrUpdateProfile(interaction.guildId!, interaction.user.id, display, bio);
  return interaction.editReply({ embeds: [makeEmbed('Profile updated.', undefined, interaction.guildId || undefined)] });
};

export const stats = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const total = countTicketsByGuild(interaction.guildId!);
  const open = countOpenTicketsByGuild(interaction.guildId!);
  const guildId = interaction.guildId!;
  const settings = getGuildSettings(guildId);

  const db = require('../lib/database').default;

  const responseTimeStmt = db.prepare(`
    SELECT AVG(t.closedAt - t.createdAt) as avgResponseTime
    FROM tickets t
    INNER JOIN ticket_meta tm ON t.id = tm.ticketId
    WHERE t.guildId = ? AND tm.claimedBy IS NOT NULL AND t.closedAt IS NOT NULL
  `);
  const responseTimeResult = responseTimeStmt.get(guildId) as any;
  let avgResponseMs = responseTimeResult?.avgResponseTime ? Math.round(responseTimeResult.avgResponseTime) : null;

  const resolveTimeStmt = db.prepare(`
    SELECT AVG(t.closedAt - t.createdAt) as avgResolveTime
    FROM tickets t
    WHERE t.guildId = ? AND t.closedAt IS NOT NULL
  `);
  const resolveTimeResult = resolveTimeStmt.get(guildId) as any;
  let avgResolveMs = resolveTimeResult?.avgResolveTime ? Math.round(resolveTimeResult.avgResolveTime) : null;

  if (avgResponseMs !== null) {
    const allResponseStmt = db.prepare(`
      SELECT tm.claimedBy as userId, AVG(t.closedAt - t.createdAt) as avgTime
      FROM tickets t
      INNER JOIN ticket_meta tm ON t.id = tm.ticketId
      WHERE t.guildId = ? AND tm.claimedBy IS NOT NULL AND t.closedAt IS NOT NULL
      GROUP BY tm.claimedBy
    `);
    const allResponseRows = allResponseStmt.all(guildId) as any[];
    const staffResponseRows = allResponseRows.filter(r => isStaffUser(r.userId, guildId, ctx.client));
    if (staffResponseRows.length > 0) {
      const totalTime = staffResponseRows.reduce((sum, r) => sum + r.avgTime, 0);
      avgResponseMs = Math.round(totalTime / staffResponseRows.length);
    }
  }

  if (avgResolveMs !== null) {
    const allResolveStmt = db.prepare(`
      SELECT t.closedBy as userId, AVG(t.closedAt - t.createdAt) as avgTime
      FROM tickets t
      WHERE t.guildId = ? AND t.closedAt IS NOT NULL AND t.closedBy IS NOT NULL
      GROUP BY t.closedBy
    `);
    const allResolveRows = allResolveStmt.all(guildId) as any[];
    const staffResolveRows = allResolveRows.filter(r => isStaffUser(r.userId, guildId, ctx.client));
    if (staffResolveRows.length > 0) {
      const totalTime = staffResolveRows.reduce((sum, r) => sum + r.avgTime, 0);
      avgResolveMs = Math.round(totalTime / staffResolveRows.length);
    }
  }

  const target = interaction.options.getUser('user', false);
  if (target) {
    const uid = target.id;

    const userResponseStmt = db.prepare(`
      SELECT AVG(t.closedAt - t.createdAt) as avgResponseTime
      FROM tickets t
      INNER JOIN ticket_meta tm ON t.id = tm.ticketId
      WHERE t.guildId = ? AND tm.claimedBy = ? AND t.closedAt IS NOT NULL
    `);
    const userResponseResult = userResponseStmt.get(guildId, uid) as any;
    const avgUserResponseMs = userResponseResult?.avgResponseTime ? Math.round(userResponseResult.avgResponseTime) : null;

    const userResolveStmt = db.prepare(`
      SELECT AVG(t.closedAt - t.createdAt) as avgResolveTime
      FROM tickets t
      WHERE t.guildId = ? AND t.closedBy = ? AND t.closedAt IS NOT NULL
    `);
    const userResolveResult = userResolveStmt.get(guildId, uid) as any;
    const avgUserResolveMs = userResolveResult?.avgResolveTime ? Math.round(userResolveResult.avgResolveTime) : null;

    const userClaimedStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM tickets t
      INNER JOIN ticket_meta tm ON t.id = tm.ticketId
      WHERE t.guildId = ? AND tm.claimedBy = ? AND t.closedAt IS NOT NULL
    `);
    const userClaimedResult = userClaimedStmt.get(guildId, uid) as any;
    const userClaimedCount = userClaimedResult?.count || 0;

    const userClosedStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM tickets t
      WHERE t.guildId = ? AND t.closedBy = ? AND t.closedAt IS NOT NULL
    `);
    const userClosedResult = userClosedStmt.get(guildId, uid) as any;
    const userClosedCount = userClosedResult?.count || 0;

    const lines = [
      `User stats for ${target.tag}:`,
      `Tickets (server): total ${total}, open ${open}`,
      `Avg response (server-wide): ${formatMs(avgResponseMs)}`,
      `Avg response: ${formatMs(avgUserResponseMs)} (${userClaimedCount} first-responses)`,
      `Avg resolve: ${formatMs(avgUserResolveMs)} (${userClosedCount} closes)`
    ];
    return interaction.editReply({ embeds: [makeEmbed(lines.join('\n'), undefined, guildId)] });
  }

  const out = [
    `Tickets: total ${total}, open ${open}`,
    `Avg response time: ${formatMs(avgResponseMs)}`,
    `Avg resolve time: ${formatMs(avgResolveMs)}`
  ];
  return interaction.editReply({ embeds: [makeEmbed(out.join('\n'), undefined, guildId)] });
};

function formatMs(ms: number | null) {
  if (ms === null || typeof ms === 'undefined') return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / (1000 * 60)) % 60;
  const h = Math.floor(ms / (1000 * 60 * 60));
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

export const viewprofile = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const user = interaction.options.getUser('user', true);
  const profile = getProfile(interaction.guildId!, user.id) as any | null;
  if (!profile) return interaction.editReply({ embeds: [makeEmbed('No profile.', undefined, interaction.guildId || undefined)] });

  const db = require('../lib/database').default;
  
  const statsStmt = db.prepare('SELECT closedCount, claimedCount FROM staff_stats WHERE guildId = ? AND userId = ?');
  const stats = statsStmt.get(interaction.guildId!, user.id) as any;

  const responseTimeStmt = db.prepare(`
    SELECT AVG(t.closedAt - t.createdAt) as avgResponseTime
    FROM tickets t
    INNER JOIN ticket_meta tm ON t.id = tm.ticketId
    WHERE t.guildId = ? AND tm.claimedBy = ? AND t.closedAt IS NOT NULL
  `);
  const responseTimeResult = responseTimeStmt.get(interaction.guildId!, user.id) as any;

  const resolveTimeStmt = db.prepare(`
    SELECT AVG(t.closedAt - t.createdAt) as avgResolveTime
    FROM tickets t
    WHERE t.guildId = ? AND t.closedBy = ? AND t.closedAt IS NOT NULL
  `);
  const resolveTimeResult = resolveTimeStmt.get(interaction.guildId!, user.id) as any;

  const closedCount = stats?.closedCount || 0;
  const claimedCount = stats?.claimedCount || 0;
  const avgResponseMs = responseTimeResult?.avgResponseTime || null;
  const avgResolveMs = resolveTimeResult?.avgResolveTime || null;

  const lines = [
    `**Profile for ${user.tag}**`,
    profile.displayName ? `Display Name: ${profile.displayName}` : '',
    profile.bio ? `Bio: ${profile.bio}` : '',
    profile.timezone ? `Timezone: ${profile.timezone}` : '',
    profile.activeHours ? `Active Hours: ${profile.activeHours}` : '',
    '',
    `**Statistics**`,
    `Tickets Closed: ${closedCount}`,
    `Tickets Claimed: ${claimedCount}`,
    `Avg Response Time: ${formatMs(avgResponseMs)}`,
    `Avg Resolve Time: ${formatMs(avgResolveMs)}`
  ].filter(Boolean).join('\n');

  return interaction.editReply({ embeds: [makeEmbed(lines, undefined, interaction.guildId || undefined)] });
};
