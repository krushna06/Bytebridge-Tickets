import { ChatInputCommandInteraction, Channel } from 'discord.js';
import {
  getTicketByChannel,
  getGuildSettings,
  setTicketMeta,
  getTicketMeta,
  incStaffStat
} from '../../lib/database';
import { Ctx, makeEmbed, isStaffFromSettings } from './common';

export const add = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const channel = interaction.channel as Channel | null;
  if (!channel || !('isTextBased' in channel) || !(channel as any).isTextBased()) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a ticket channel')] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to add users to tickets.')] });
  await (channel as any).permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
  return interaction.editReply({ embeds: [makeEmbed(`Added ${user.tag} to the ticket.`)] });
};

export const remove = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const channel = interaction.channel as Channel | null;
  if (!channel || !('isTextBased' in channel) || !(channel as any).isTextBased()) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a ticket channel')] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to remove users from tickets.')] });
  await (channel as any).permissionOverwrites.edit(user.id, { ViewChannel: false });
  return interaction.editReply({ embeds: [makeEmbed(`Removed ${user.tag} from the ticket.`)] });
};

export const transfer = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to transfer this ticket.')] });
  setTicketMeta(ticket.id, { ownerId: user.id, guildId: ticket.guildId });
  return interaction.editReply({ embeds: [makeEmbed(`Ticket transferred to ${user.tag}.`)] });
};

export const claim = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to claim tickets.')] });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
  const meta = getTicketMeta(ticket.id as number);
  if (meta && meta.claimedBy) return interaction.editReply({ embeds: [makeEmbed(`Ticket already claimed by <@${meta.claimedBy}>.`)] });
  await ctx.ticketManager.claimTicket(interaction.channel!.id, interaction.user.id);
  setTicketMeta(ticket.id, { claimedBy: interaction.user.id, guildId: ticket.guildId });
  incStaffStat(ticket.guildId, interaction.user.id, 'claimedCount');
  return interaction.editReply({ embeds: [makeEmbed('Ticket claimed.')] });
};

export const forceClose = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to force-close tickets.')] });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
  const result = await ctx.ticketManager.closeTicket(interaction.channel!.id, interaction.user.id);
  incStaffStat(ticket.guildId, interaction.user.id, 'closedCount');
  return interaction.editReply({ embeds: [makeEmbed(`Ticket forcibly closed. Transcript: ${result.transcriptPath}`)] });
};

export const move = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const category = interaction.options.getChannel('channel', true) || interaction.options.getChannel('category', true);
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to move tickets.')] });
  if (!interaction.channel || !('setParent' in interaction.channel)) return interaction.editReply({ embeds: [makeEmbed('This command must be used in a ticket channel')] });
  await (interaction.channel as any).setParent((category as any).id as string);
  return interaction.editReply({ embeds: [makeEmbed(`Moved ticket to category ${(category as any).name}.`)] });
};

export const priority = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const level = interaction.options.getString('level', true);
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to set priority.')] });
  setTicketMeta(ticket.id, { priority: level, guildId: ticket.guildId });
  return interaction.editReply({ embeds: [makeEmbed(`Priority set to ${level}.`)] });
};

export const release = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const ticket = getTicketByChannel(interaction.channel?.id || '') as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (!isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to release tickets.')] });
  setTicketMeta(ticket.id, { claimedBy: undefined as any, guildId: ticket.guildId });
  return interaction.editReply({ embeds: [makeEmbed('Ticket released (unclaimed).')] });
};

export const close = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.channel) return interaction.editReply({ embeds: [makeEmbed('No channel')] });
  const ticket = getTicketByChannel(interaction.channel.id) as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to close this ticket.')] });
  const result = await ctx.ticketManager.closeTicket(interaction.channel.id, interaction.user.id);
  if (settings && (settings as any).transcriptChannelId && result.transcriptPath) {
    try {
      const tc = await ctx.client.channels.fetch((settings as any).transcriptChannelId);
      if (tc && (tc as any).isTextBased()) await (tc as any).send({ content: `Transcript for ticket ${result.ticketId}`, files: [result.transcriptPath] as any });
    } catch(e) {}
  }
  if (ticket) incStaffStat(ticket.guildId, interaction.user.id, 'closedCount');
  return interaction.editReply({ embeds: [makeEmbed(`Ticket closed. Transcript: ${result.transcriptPath}`)] });
};

export const rename = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const newName = interaction.options.getString('name', true);
  if (!interaction.channel || !('isTextBased' in interaction.channel) || !(interaction.channel as any).isTextBased()) return interaction.editReply('This command must be used in a ticket channel');
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;
  const member = interaction.guild ? interaction.guild.members.cache.get(interaction.user.id) : null;
  const ticket = getTicketByChannel(interaction.channel.id) as any | null;
  if (!ticket) return interaction.editReply({ embeds: [makeEmbed('This channel is not a ticket.')] });
  if (ticket.userId !== interaction.user.id && !isStaffFromSettings(member, settings)) return interaction.editReply({ embeds: [makeEmbed('You do not have permission to rename this ticket.')] });
  await (interaction.channel as any).setName(newName);
  return interaction.editReply({ embeds: [makeEmbed(`Channel renamed to ${newName}.`)] });
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
