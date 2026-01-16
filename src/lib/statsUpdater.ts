import { Client, EmbedBuilder, GuildMember } from 'discord.js';
import { getPanelsWithStats, countTicketsByGuild, countOpenTicketsByGuild, listTicketsForGuild, getGuildSettings } from './database';
import { isStaffFromSettings } from '../handlers/common';

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

function isStaffUser(userId: string, guildId: string, client: Client): boolean {
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

function createStatsEmbed(guildId: string, embedColor?: string, client?: Client): EmbedBuilder {
  const total = countTicketsByGuild(guildId);
  const open = countOpenTicketsByGuild(guildId);

  const tickets = listTicketsForGuild(guildId);
  const closed = tickets.filter(t => t.closedAt && t.closedAt > 0);
  
  const staffClosed = client ? closed.filter(t => t.closedBy && isStaffUser(t.closedBy, guildId, client)) : closed;
  const resolveDurations = staffClosed.map(t => (t.closedAt! - t.createdAt)).filter(d => typeof d === 'number' && d >= 0);
  const avgResolveMs = resolveDurations.length ? Math.round(resolveDurations.reduce((a, b) => a + b, 0) / resolveDurations.length) : null;

  const db = require('./database').default;
  
  const responseTimeStmt = db.prepare(`
    SELECT AVG(t.closedAt - t.createdAt) as avgResponseTime
    FROM tickets t
    INNER JOIN ticket_meta tm ON t.id = tm.ticketId
    WHERE t.guildId = ? AND tm.claimedBy IS NOT NULL AND t.closedAt IS NOT NULL
  `);
  const responseTimeResult = responseTimeStmt.get(guildId) as any;
  let avgResponseMs = responseTimeResult?.avgResponseTime ? Math.round(responseTimeResult.avgResponseTime) : null;

  if (avgResponseMs !== null && client) {
    const allResponseStmt = db.prepare(`
      SELECT tm.claimedBy as userId, AVG(t.closedAt - t.createdAt) as avgTime
      FROM tickets t
      INNER JOIN ticket_meta tm ON t.id = tm.ticketId
      WHERE t.guildId = ? AND tm.claimedBy IS NOT NULL AND t.closedAt IS NOT NULL
      GROUP BY tm.claimedBy
    `);
    const allResponseRows = allResponseStmt.all(guildId) as any[];
    const staffResponseRows = allResponseRows.filter(r => isStaffUser(r.userId, guildId, client));
    if (staffResponseRows.length > 0) {
      const totalTime = staffResponseRows.reduce((sum, r) => sum + r.avgTime, 0);
      avgResponseMs = Math.round(totalTime / staffResponseRows.length);
    }
  }

  const feedbackStmt = db.prepare('SELECT AVG(score) as avgScore FROM ticket_feedback WHERE guildId = ?');
  const feedbackResult = feedbackStmt.get(guildId) as any;
  const avgFeedback = feedbackResult?.avgScore || 0;

  const feedbackCountStmt = db.prepare('SELECT COUNT(*) as count FROM ticket_feedback WHERE guildId = ?');
  const feedbackCountResult = feedbackCountStmt.get(guildId) as any;
  const feedbackCount = feedbackCountResult?.count || 0;

  const color = embedColor ? parseInt(embedColor.replace('#', ''), 16) : 0x5865f2;

  const embed = new EmbedBuilder()
    .setTitle('Support Statistics')
    .setColor(color)
    .addFields(
      { name: 'Total Tickets', value: String(total), inline: true },
      { name: 'Open Tickets', value: String(open), inline: true },
      { name: 'Closed Tickets', value: String(staffClosed.length), inline: true },
      { name: 'Avg Response Time', value: formatMs(avgResponseMs), inline: true },
      { name: 'Avg Resolve Time', value: formatMs(avgResolveMs), inline: true },
      { name: 'Avg Feedback', value: feedbackCount > 0 ? `${(avgFeedback).toFixed(2)}/5 (${feedbackCount} ratings)` : 'No ratings yet', inline: true }
    );

  return embed;
}

export async function updateStatsEmbeds(client: Client, guildId: string) {
  try {
    const panels = getPanelsWithStats(guildId);
    if (!panels.length) return;

    for (const panel of panels) {
      if (!panel.channelId || !panel.statsMessageId) continue;

      try {
        const channel = await client.channels.fetch(panel.channelId) as any;
        if (!channel || typeof channel.isTextBased !== 'function' || !channel.isTextBased()) continue;

        const message = await channel.messages.fetch(panel.statsMessageId);
        if (message) {
          const statsEmbed = createStatsEmbed(guildId, (panel as any).embedColor || undefined, client);
          await message.edit({ embeds: [statsEmbed] });
        }
      } catch (error) {
        console.error(`Failed to update stats embed for panel ${panel.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error updating stats embeds:', error);
  }
}
