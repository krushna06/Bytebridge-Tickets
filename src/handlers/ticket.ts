import { ChatInputCommandInteraction, Channel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  getTicketByChannel,
  getGuildSettings,
  setTicketMeta,
  getTicketMeta,
  incStaffStat,
  createTicketRow,
  getTicketById
} from '../lib/database';
import { Ctx, makeEmbed, isStaffFromSettings } from './common';

export const add = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const channel = interaction.channel as Channel | null;
  if (!channel || !('isTextBased' in channel) || !(channel as any).isTextBased()) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a ticket channel', undefined, interaction.guildId || undefined)] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to add users to tickets.', undefined, interaction.guildId || undefined)] });
  await (channel as any).permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
  return interaction.editReply({ embeds: [makeEmbed(`Added ${user.tag} to the ticket.`, undefined, interaction.guildId || undefined)] });
};

export const remove = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const channel = interaction.channel as Channel | null;
  if (!channel || !('isTextBased' in channel) || !(channel as any).isTextBased()) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a ticket channel', undefined, interaction.guildId || undefined)] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to remove users from tickets.', undefined, interaction.guildId || undefined)] });
  await (channel as any).permissionOverwrites.edit(user.id, { ViewChannel: false });
  return interaction.editReply({ embeds: [makeEmbed(`Removed ${user.tag} from the ticket.`, undefined, interaction.guildId || undefined)] });
};

export const transfer = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.', undefined, interaction.guildId || undefined)] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to transfer this ticket.', undefined, interaction.guildId || undefined)] });
  setTicketMeta(ticket.id, { ownerId: user.id, guildId: ticket.guildId });
  return interaction.editReply({ embeds: [makeEmbed(`Ticket transferred to ${user.tag}.`, undefined, interaction.guildId || undefined)] });
};

export const claim = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to claim tickets.', undefined, interaction.guildId || undefined)] });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.', undefined, interaction.guildId || undefined)] });
  const meta = getTicketMeta(ticket.id as number);
  if (meta && meta.claimedBy) return interaction.editReply({ embeds: [makeEmbed(`Ticket already claimed by <@${meta.claimedBy}>.`, undefined, interaction.guildId || undefined)] });
  await ctx.ticketManager.claimTicket(interaction.channel!.id, interaction.user.id);
  setTicketMeta(ticket.id, { claimedBy: interaction.user.id, guildId: ticket.guildId });
  incStaffStat(ticket.guildId, interaction.user.id, 'claimedCount');
  return interaction.editReply({ embeds: [makeEmbed('Ticket claimed.', undefined, interaction.guildId || undefined)] });
};

export const forceClose = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const ticketId = interaction.options.getString('ticketid', true);
  const reason = interaction.options.getString('reason', false) || 'No reason provided';
  
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to force-close tickets.', undefined, interaction.guildId || undefined)] });
  
  const ticket = getTicketById(Number(ticketId)) as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('Ticket not found.', undefined, interaction.guildId || undefined)] });
  
  try {
    const result = await ctx.ticketManager.closeTicket(ticket.channelId, interaction.user.id, reason);
    incStaffStat(ticket.guildId, interaction.user.id, 'closedCount');
    return interaction.editReply({ embeds: [makeEmbed(`Ticket #${ticketId} forcibly closed.\nReason: ${reason}`, undefined, interaction.guildId || undefined)] });
  } catch (err: any) {
    return interaction.editReply({ embeds: [makeEmbed(`Error closing ticket: ${err?.message || 'Unknown error'}`, undefined, interaction.guildId || undefined)] });
  }
};

export const move = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const category = interaction.options.getChannel('channel', true) || interaction.options.getChannel('category', true);
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to move tickets.', undefined, interaction.guildId || undefined)] });
  if (!interaction.channel || !('setParent' in interaction.channel)) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a ticket channel', undefined, interaction.guildId || undefined)] });
  await (interaction.channel as any).setParent((category as any).id as string);
  return interaction.editReply({ embeds: [makeEmbed(`Moved ticket to category ${(category as any).name}.`, undefined, interaction.guildId || undefined)] });
};

export const priority = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const level = interaction.options.getString('level', true);
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.', undefined, interaction.guildId || undefined)] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to set priority.', undefined, interaction.guildId || undefined)] });
  setTicketMeta(ticket.id, { priority: level, guildId: ticket.guildId });
  return interaction.editReply({ embeds: [makeEmbed(`Priority set to ${level}.`, undefined, interaction.guildId || undefined)] });
};

export const release = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.', undefined, interaction.guildId || undefined)] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to release tickets.', undefined, interaction.guildId || undefined)] });
  setTicketMeta(ticket.id, { claimedBy: undefined as any, guildId: ticket.guildId });
  return interaction.editReply({ embeds: [makeEmbed('Ticket released (unclaimed).', undefined, interaction.guildId || undefined)] });
};

export const close = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  if (!interaction.channel) return interaction.reply({ embeds: [makeEmbed('No channel', undefined, interaction.guildId || undefined)], ephemeral: true });
  const ticket = getTicketByChannel(interaction.channel.id) as any | null;
  if (!ticket) return interaction.reply({ embeds: [makeEmbed('This channel is not a ticket.', undefined, interaction.guildId || undefined)], ephemeral: true });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.reply({ embeds: [makeEmbed('You do not have permission to close this ticket.', undefined, interaction.guildId || undefined)], ephemeral: true });
  
  const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
  
  const modal = new ModalBuilder()
    .setCustomId(`close_reason_modal:${ticket.id}`)
    .setTitle('Close Ticket');
  
  const reasonInput = new TextInputBuilder()
    .setCustomId('close_reason')
    .setLabel('Reason for closing')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder('Leave empty for "No reason provided"');
  
  const row = new (ActionRowBuilder as any)().addComponents(reasonInput);
  modal.addComponents(row);
  
  await interaction.showModal(modal);
};

export const rename = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const newName = interaction.options.getString('name', true);
  if (!interaction.channel || !('isTextBased' in interaction.channel) || !(interaction.channel as any).isTextBased()) return interaction.editReply('This command must be used in a ticket channel');
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  const ticket = getTicketByChannel(interaction.channel.id) as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.', undefined, interaction.guildId || undefined)] });
  if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to rename this ticket.', undefined, interaction.guildId || undefined)] });
  await (interaction.channel as any).setName(newName);
  return interaction.editReply({ embeds: [makeEmbed(`Channel renamed to ${newName}.`, undefined, interaction.guildId || undefined)] });
};

export const topic = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const topic = interaction.options.getString('topic', true);
  if (!interaction.channel || !('isTextBased' in interaction.channel) || !(interaction.channel as any).isTextBased()) return interaction.editReply('This command must be used in a ticket channel');
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  const ticket = getTicketByChannel(interaction.channel.id) as any | null;
  if (!ticket) return interaction.editReply('This channel is not a ticket.');
  if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply('You do not have permission to set the topic.');
  await (interaction.channel as any).setTopic(topic);
  return interaction.editReply({ content: 'Topic updated.' });
};

export const transcript = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply('This channel is not a ticket.');
  if (!ticket.transcriptPath) return interaction.editReply('No transcript saved yet.');
  return interaction.editReply({ content: `Transcript path: ${ticket.transcriptPath}` });
};

export const setticket = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel', true);
  const user = interaction.options.getUser('user', false);
  
  if (!interaction.guildId) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a guild.', undefined, interaction.guildId || undefined)] });
  
  const settings = getGuildSettings(interaction.guildId);
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  
  if (!isStaffFromSettings(member, settings)) {
    return interaction.editReply({ embeds: [makeEmbed('You do not have permission to set tickets.', undefined, interaction.guildId)] });
  }
  
  if (!channel || !('isTextBased' in channel) || !(channel as any).isTextBased()) {
    return interaction.editReply({ embeds: [makeEmbed('The channel must be a text channel.', undefined, interaction.guildId)] });
  }
  
  const existingTicket = getTicketByChannel(channel.id);
  if (existingTicket) {
    return interaction.editReply({ embeds: [makeEmbed('This channel is already a ticket.', undefined, interaction.guildId)] });
  }
  
  const ticketOwner = user || interaction.user;
  
  try {
    const ticketId = createTicketRow({
      guildId: interaction.guildId,
      channelId: channel.id,
      userId: ticketOwner.id,
      status: 'open',
      createdAt: Date.now()
    });
    
    setTicketMeta(ticketId, { ownerId: ticketOwner.id, guildId: interaction.guildId });
    
    return interaction.editReply({ 
      embeds: [makeEmbed(
        `Channel <#${channel.id}> has been converted to a ticket (ID: ${ticketId}) assigned to ${ticketOwner.tag}.`,
        undefined,
        interaction.guildId
      )] 
    });
  } catch (err: any) {
    console.error('Error setting ticket:', err);
    return interaction.editReply({ embeds: [makeEmbed(`Error: ${err?.message || 'Failed to set ticket'}`, undefined, interaction.guildId)] });
  }
};
