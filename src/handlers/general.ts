import { ChatInputCommandInteraction } from 'discord.js';
import { getTag, listTicketsForUser } from '../lib/database';
import { Ctx, makeEmbed } from './common';

export const help = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.reply({ embeds: [makeEmbed('Commands: /new /tag /tickets /add /remove /transfer /note /stickynotes /viewnotes /claim /force-close /move /priority /release /leaderboard /setprofile /stats /viewprofile /close /rename /topic /transcript')], ephemeral: true });
};

export const _new = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const reason = interaction.options.getString('title') || interaction.options.getString('reason') || undefined;
  const category = interaction.options.getChannel('category') as any;
  const opener = interaction.guild?.members.cache.get(interaction.user.id) ?? (interaction.member as any);
  const result = await ctx.ticketManager.createTicket(interaction.guild!, opener, reason, category && category.id ? category.id : undefined);
  await interaction.editReply({ embeds: [makeEmbed(`Ticket created: <#${result.channel.id}> (ID: ${result.ticketId})`)] });
};

export const tag = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const tagName = interaction.options.getString('name', true);
  const tag = getTag(interaction.guildId!, tagName) as any | null;
  if (!tag) return interaction.editReply({ embeds: [makeEmbed(`Tag '${tagName}' not found.`)] });
  return interaction.editReply({ embeds: [makeEmbed(tag.content)] });
};

export const tickets = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user') || interaction.user;
  const rows = listTicketsForUser(interaction.guildId!, user.id);
  if (!rows.length) return interaction.editReply({ embeds: [makeEmbed('No tickets found.')] });
  const list = rows.map((r: any) => `#${r.id} - <#${r.channelId}> - ${r.status}`).join('\n');
  return interaction.editReply({ embeds: [makeEmbed(`Tickets:\n${list}`)] });
};
