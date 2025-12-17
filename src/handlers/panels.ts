import { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { createPanel, getPanelById, getLatestPanelForGuild, updatePanelMessage, listPanels, getPanelByChannel, deletePanel } from '../lib/database';
import { Ctx, makeEmbed, isStaffFromSettings } from './common';

export const panel = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const settings = interaction.guildId ? (await import('../lib/database')).getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to manage panels.')] });
  let sub = 'create';
  try { sub = interaction.options.getSubcommand(); } catch (e) { sub = 'create'; }
  if (sub === 'create') {
    const title = interaction.options.getString('title') || null;
    const buttons: Array<{ label: string; categoryId?: string | null }> = [];
    for (let i = 1; i <= 5; i++) {
      const b = interaction.options.getString(`button${i}` as any);
      const cat = interaction.options.getChannel(`button${i}_category` as any) as any;
      if (b && b.trim()) buttons.push({ label: b.trim(), categoryId: cat && cat.id ? cat.id : null });
    }
    if (!buttons.length) return interaction.editReply({ embeds: [makeEmbed('Please provide at least one button label (up to 5).')] });
    const panelId = createPanel(interaction.guildId!, title, interaction.user.id, buttons as any);
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
      }
      return interaction.editReply({ embeds: [makeEmbed(`Panel created and posted to ${postChannel}.`)] });
    }
    return interaction.editReply({ embeds: [makeEmbed(`Panel created with id ${panelId}. Run /sendpanel to post it to a channel.`)] });
  }
  if (sub === 'list') {
    const panels = listPanels(interaction.guildId!);
    if (!panels.length) return interaction.editReply({ embeds: [makeEmbed('No panels found for this guild.')] });
    const out = panels.map((p: any) => `#${p.id} - ${p.title || 'Untitled'} - posted in <#${p.channelId}> message ${p.messageId || 'N/A'}`).join('\n');
    return interaction.editReply({ embeds: [makeEmbed(`Panels:\n${out}`)] });
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
    if (!panel) return interaction.editReply({ embeds: [makeEmbed('Panel not found. Provide a valid id or the channel where it was posted.')] });
    if (panel.channelId && panel.messageId) {
      try {
        const ch = await ctx.client.channels.fetch(panel.channelId as string) as any;
        if (ch && ch.isTextBased && ch.isTextBased()) {
          try { const msg = await ch.messages.fetch(panel.messageId as string); if (msg) await msg.delete(); } catch (e) {}
        }
      } catch (e) {}
    }
    deletePanel(panel.id);
    return interaction.editReply({ embeds: [makeEmbed(`Panel #${panel.id} deleted.`)] });
  }

  return interaction.editReply({ embeds: [makeEmbed('Unknown panel subcommand.')] });
};

export const sendpanel = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const settings = interaction.guildId ? (await import('../lib/database')).getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to send panels.')] });
  const channel = interaction.options.getChannel('channel') as any;
  if (!channel || !('isTextBased' in channel) || !channel.isTextBased()) return interaction.editReply({ embeds: [makeEmbed('Please provide a valid text channel.')] });
  const pid = interaction.options.getInteger('panel_id');
  const panel = typeof pid === 'number' ? getPanelById(pid) : getLatestPanelForGuild(interaction.guildId!);
  if (!panel) return interaction.editReply({ embeds: [makeEmbed('No saved panel found for this guild. Create one with /panel create.')] });
  const embed = new EmbedBuilder().setTitle(panel.title || 'Ticket Panel').setDescription('Click a button below to open a ticket.');
  const row = new ActionRowBuilder<ButtonBuilder>();
  panel.buttons.slice(0,5).forEach((b: any, idx: number) => {
    const label = (b && (b.label || b)) || `Category ${idx + 1}`;
    const btn = new ButtonBuilder().setCustomId(`panel_open:${panel.id}:${idx}`).setLabel(label).setStyle(ButtonStyle.Primary as any);
    row.addComponents(btn as any);
  });
  const sent = await channel.send({ embeds: [embed], components: [row as any] });
  updatePanelMessage(panel.id, channel.id, sent.id);
  return interaction.editReply({ embeds: [makeEmbed(`Panel sent to ${channel}`)] });
};
