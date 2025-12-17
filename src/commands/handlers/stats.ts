import { ChatInputCommandInteraction } from 'discord.js';
import { createOrUpdateProfile, getProfile, getLeaderboard, countTicketsByGuild, countOpenTicketsByGuild } from '../../lib/database';
import { Ctx, makeEmbed } from './common';

export const leaderboard = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const rows = getLeaderboard(interaction.guildId!);
  if (!rows.length) return interaction.editReply({ embeds: [makeEmbed('No stats yet.')] });
  const out = rows.map((r: any, i: number) => `${i + 1}. <@${r.userId}> - closed: ${r.closedCount || 0}, claimed: ${r.claimedCount || 0}`).join('\n');
  return interaction.editReply({ embeds: [makeEmbed(`Leaderboard:\n${out}`)] });
};

export const setprofile = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const display = interaction.options.getString('display') || interaction.options.getString('name') || undefined;
  const bio = interaction.options.getString('bio') || undefined;
  createOrUpdateProfile(interaction.guildId!, interaction.user.id, display, bio);
  return interaction.editReply({ embeds: [makeEmbed('Profile updated.')] });
};

export const stats = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const total = countTicketsByGuild(interaction.guildId!);
  const open = countOpenTicketsByGuild(interaction.guildId!);
  return interaction.editReply({ embeds: [makeEmbed(`Tickets: total ${total}, open ${open}`)] });
};

export const viewprofile = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ ephemeral: true });
  const user = interaction.options.getUser('user', true);
  const profile = getProfile(interaction.guildId!, user.id) as any | null;
  if (!profile) return interaction.editReply({ embeds: [makeEmbed('No profile.')] });
  return interaction.editReply({ embeds: [makeEmbed(`Profile for ${user.tag}: ${profile.displayName || ''} - ${profile.bio || ''}`)] });
};
