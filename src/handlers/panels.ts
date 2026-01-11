import { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { createPanel, getPanelById, getLatestPanelForGuild, updatePanelMessage, listPanels, getPanelByChannel, deletePanel, updatePanelStatsMessage, countTicketsByGuild, countOpenTicketsByGuild, listTicketsForGuild, getCategoryByDiscordId } from '../lib/database';
import { Ctx, makeEmbed, isStaffFromSettings } from './common';
import fs from 'fs';

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

export function createStatsEmbed(guildId: string, embedColor?: string): EmbedBuilder {
  const total = countTicketsByGuild(guildId);
  const open = countOpenTicketsByGuild(guildId);
  
  const tickets = listTicketsForGuild(guildId);
  const closed = tickets.filter(t => t.closedAt && t.closedAt > 0);
  const resolveDurations = closed.map(t => (t.closedAt! - t.createdAt)).filter(d => typeof d === 'number' && d >= 0);
  const avgResolveMs = resolveDurations.length ? Math.round(resolveDurations.reduce((a, b) => a + b, 0) / resolveDurations.length) : null;

  const db = require('../lib/database').default;
  
  const responseTimeStmt = db.prepare(`
    SELECT AVG(t.closedAt - t.createdAt) as avgResponseTime
    FROM tickets t
    INNER JOIN ticket_meta tm ON t.id = tm.ticketId
    WHERE t.guildId = ? AND tm.claimedBy IS NOT NULL AND t.closedAt IS NOT NULL
  `);
  const responseTimeResult = responseTimeStmt.get(guildId) as any;
  const avgResponseMs = responseTimeResult?.avgResponseTime ? Math.round(responseTimeResult.avgResponseTime) : null;

  const feedbackStmt = db.prepare('SELECT AVG(score) as avgScore FROM ticket_feedback WHERE guildId = ?');
  const feedbackResult = feedbackStmt.get(guildId) as any;
  const avgFeedback = feedbackResult?.avgScore || 0;

  const feedbackCountStmt = db.prepare('SELECT COUNT(*) as count FROM ticket_feedback WHERE guildId = ?');
  const feedbackCountResult = feedbackCountStmt.get(guildId) as any;
  const feedbackCount = feedbackCountResult?.count || 0;

  const color = embedColor ? parseInt(embedColor.replace('#', ''), 16) : 0x5865f2;

  const embed = new EmbedBuilder()
    .setTitle('📊 Support Statistics')
    .setColor(color)
    .addFields(
      { name: 'Total Tickets', value: String(total), inline: true },
      { name: 'Open Tickets', value: String(open), inline: true },
      { name: 'Closed Tickets', value: String(closed.length), inline: true },
      { name: 'Avg Response Time', value: formatMs(avgResponseMs), inline: true },
      { name: 'Avg Resolve Time', value: formatMs(avgResolveMs), inline: true },
      { name: 'Avg Feedback', value: feedbackCount > 0 ? `${(avgFeedback).toFixed(2)}/5 (${feedbackCount} ratings)` : 'No ratings yet', inline: true }
    );

  return embed;
}

function createStatsEmbedInternal(guildId: string, embedColor?: string): EmbedBuilder {
  const total = countTicketsByGuild(guildId);
  const open = countOpenTicketsByGuild(guildId);
  
  const tickets = listTicketsForGuild(guildId);
  const closed = tickets.filter(t => t.closedAt && t.closedAt > 0);
  const resolveDurations = closed.map(t => (t.closedAt! - t.createdAt)).filter(d => typeof d === 'number' && d >= 0);
  const avgResolveMs = resolveDurations.length ? Math.round(resolveDurations.reduce((a, b) => a + b, 0) / resolveDurations.length) : null;

  const db = require('../lib/database').default;
  
  const responseTimeStmt = db.prepare(`
    SELECT AVG(t.closedAt - t.createdAt) as avgResponseTime
    FROM tickets t
    INNER JOIN ticket_meta tm ON t.id = tm.ticketId
    WHERE t.guildId = ? AND tm.claimedBy IS NOT NULL AND t.closedAt IS NOT NULL
  `);
  const responseTimeResult = responseTimeStmt.get(guildId) as any;
  const avgResponseMs = responseTimeResult?.avgResponseTime ? Math.round(responseTimeResult.avgResponseTime) : null;

  const feedbackStmt = db.prepare('SELECT AVG(score) as avgScore FROM ticket_feedback WHERE guildId = ?');
  const feedbackResult = feedbackStmt.get(guildId) as any;
  const avgFeedback = feedbackResult?.avgScore || 0;

  const feedbackCountStmt = db.prepare('SELECT COUNT(*) as count FROM ticket_feedback WHERE guildId = ?');
  const feedbackCountResult = feedbackCountStmt.get(guildId) as any;
  const feedbackCount = feedbackCountResult?.count || 0;

  const color = embedColor ? parseInt(embedColor.replace('#', ''), 16) : 0x5865f2;

  const embed = new EmbedBuilder()
    .setTitle('📊 Support Statistics')
    .setColor(color)
    .addFields(
      { name: 'Total Tickets', value: String(total), inline: true },
      { name: 'Open Tickets', value: String(open), inline: true },
      { name: 'Closed Tickets', value: String(closed.length), inline: true },
      { name: 'Avg Response Time', value: formatMs(avgResponseMs), inline: true },
      { name: 'Avg Resolve Time', value: formatMs(avgResolveMs), inline: true },
      { name: 'Avg Feedback', value: feedbackCount > 0 ? `${(avgFeedback).toFixed(2)}/5 (${feedbackCount} ratings)` : 'No ratings yet', inline: true }
    );

  return embed;
}

export const panel = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!member || !member.permissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to manage panels.', undefined, interaction.guildId || undefined)] });
  let sub = 'create';
  try { sub = interaction.options.getSubcommand(); } catch (e) { sub = 'create'; }
  if (sub === 'create') {
    const title = interaction.options.getString('title') || null;
    const includeStats = interaction.options.getBoolean('include_stats') || false;
    const buttons: Array<{ label: string; categoryId?: string | null; categoryDbId?: number | null }> = [];
    for (let i = 1; i <= 5; i++) {
      const b = interaction.options.getString(`button${i}` as any);
      const cat = interaction.options.getChannel(`button${i}_category` as any) as any;
      if (b && b.trim()) {
        let categoryDbId: number | null = null;
        if (cat && cat.id) {
          const category = getCategoryByDiscordId(interaction.guildId!, cat.id);
          if (category) {
            categoryDbId = category.id;
          }
        }
        buttons.push({ label: b.trim(), categoryId: cat && cat.id ? cat.id : null, categoryDbId });
      }
    }
    if (!buttons.length) return interaction.editReply({ embeds: [makeEmbed('Please provide at least one button label (up to 5).', undefined, interaction.guildId || undefined)] });
    const panelId = createPanel(interaction.guildId!, title, interaction.user.id, buttons as any, undefined, undefined, includeStats);
    const postChannel = interaction.options.getChannel('post_channel') as any;
    if (postChannel && postChannel.isTextBased && postChannel.isTextBased()) {
      const panel = getPanelById(panelId as number);
      if (panel) {
        const embed = new EmbedBuilder().setTitle(panel.title || 'Ticket Panel').setDescription('Click a button below to open a ticket.');
        const row = new ActionRowBuilder<ButtonBuilder>();
        panel.buttons.slice(0,5).forEach((b: any, idx: number) => {
          const label = (b && (b.label || b)) || `Category ${idx + 1}`;
          const btn = new ButtonBuilder().setCustomId(`panel_open:${panel.id}:${idx}`).setLabel(label).setStyle(ButtonStyle.Primary as any);
          row.addComponents(btn as any);
        });
        const sent = await postChannel.send({ embeds: [embed], components: [row as any] });
        updatePanelMessage(panel.id, postChannel.id, sent.id);

        if (includeStats) {
          const statsEmbed = createStatsEmbedInternal(interaction.guildId!, (panel as any).embedColor || undefined);
          const statsSent = await postChannel.send({ embeds: [statsEmbed] });
          updatePanelStatsMessage(panel.id, statsSent.id);
        }
      }
      return interaction.editReply({ embeds: [makeEmbed(`Panel created and posted to ${postChannel}.${includeStats ? ' Stats embed included.' : ''}`, undefined, interaction.guildId || undefined)] });
    }
    return interaction.editReply({ embeds: [makeEmbed(`Panel created with id ${panelId}. Run /sendpanel to post it to a channel.`, undefined, interaction.guildId || undefined)] });
  }
  if (sub === 'list') {
    const panels = listPanels(interaction.guildId!);
    if (!panels.length) return interaction.editReply({ embeds: [makeEmbed('No panels found for this guild.', undefined, interaction.guildId || undefined)] });
    const out = panels.map((p: any) => `#${p.id} - ${p.title || 'Untitled'} - posted in <#${p.channelId}> message ${p.messageId || 'N/A'}${p.includeStats ? ' (with stats)' : ''}`).join('\n');
    return interaction.editReply({ embeds: [makeEmbed(`Panels:\n${out}`, undefined, interaction.guildId || undefined)] });
  }

  if (sub === 'delete') {
    const idInput = interaction.options.getString('id');
    const channel = interaction.options.getChannel('channel') as any;
    let panel: any = null;
    let idNum: number | null = null;
    if (typeof idInput === 'string' && idInput.trim()) {
      const m = idInput.match(/(\d+)/);
      if (m) idNum = Number(m[1]);
    }
    if (typeof idNum === 'number' && !Number.isNaN(idNum)) panel = getPanelById(idNum);
    else if (channel) panel = getPanelByChannel(channel.id);
    if (!panel) return interaction.editReply({ embeds: [makeEmbed('Panel not found. Provide a valid id or the channel where it was posted.', undefined, interaction.guildId || undefined)] });
    if (panel.channelId && panel.messageId) {
      try {
        const ch = await ctx.client.channels.fetch(panel.channelId as string) as any;
        if (ch && ch.isTextBased && ch.isTextBased()) {
          try { const msg = await ch.messages.fetch(panel.messageId as string); if (msg) await msg.delete(); } catch (e) {}
          if (panel.statsMessageId) {
            try { const statsMsg = await ch.messages.fetch(panel.statsMessageId as string); if (statsMsg) await statsMsg.delete(); } catch (e) {}
          }
        }
      } catch (e) {}
    }
    deletePanel(panel.id);
    return interaction.editReply({ embeds: [makeEmbed(`Panel #${panel.id} deleted.`, undefined, interaction.guildId || undefined)] });
  }

  return interaction.editReply({ embeds: [makeEmbed('Unknown panel subcommand.', undefined, interaction.guildId || undefined)] });
};

export const sendpanel = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!member || !member.permissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to send panels.', undefined, interaction.guildId || undefined)] });
  const channel = interaction.options.getChannel('channel') as any;
  if (!channel || !('isTextBased' in channel) || !channel.isTextBased()) return interaction.editReply({ embeds: [makeEmbed('Please provide a valid text channel.', undefined, interaction.guildId || undefined)] });
  const pid = interaction.options.getInteger('panel_id');
  const includeStats = interaction.options.getBoolean('include_stats') || false;
  const panel = typeof pid === 'number' ? getPanelById(pid) : getLatestPanelForGuild(interaction.guildId!);
  if (!panel) return interaction.editReply({ embeds: [makeEmbed('No saved panel found for this guild. Create one with /panel create.', undefined, interaction.guildId || undefined)] });
  const embed = new EmbedBuilder().setTitle(panel.title || 'Ticket Panel').setDescription('Click a button below to open a ticket.');
  const row = new ActionRowBuilder<ButtonBuilder>();
  panel.buttons.slice(0,5).forEach((b: any, idx: number) => {
    const label = (b && (b.label || b)) || `Category ${idx + 1}`;
    const btn = new ButtonBuilder().setCustomId(`panel_open:${panel.id}:${idx}`).setLabel(label).setStyle(ButtonStyle.Primary as any);
    row.addComponents(btn as any);
  });
  const sent = await channel.send({ embeds: [embed], components: [row as any] });
  updatePanelMessage(panel.id, channel.id, sent.id);
  
  const shouldIncludeStats = (panel as any).includeStats || includeStats;
  if (shouldIncludeStats) {
    const statsEmbed = createStatsEmbedInternal(interaction.guildId!, (panel as any).embedColor || undefined);
    const statsSent = await channel.send({ embeds: [statsEmbed] });
    updatePanelStatsMessage(panel.id, statsSent.id);
    if (!((panel as any).includeStats)) {
      const { enablePanelStats } = await import('../lib/database');
      enablePanelStats(panel.id);
    }
  }
  
  return interaction.editReply({ embeds: [makeEmbed(`Panel sent to ${channel}${shouldIncludeStats ? ' with stats embed' : ''}`, undefined, interaction.guildId || undefined)] });
};
