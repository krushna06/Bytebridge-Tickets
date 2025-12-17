import { ChatInputCommandInteraction } from 'discord.js';
import { getTag, listTicketsForUser } from '../lib/database';
import path from 'path';
import { Ctx, makeEmbed } from './common';
import commandsList from '../commands';

export const help = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  try {
    const cmds = (commandsList as any[]).map((c: any) => {
      try {
        if (c && c.data && typeof c.data.toJSON === 'function') {
          return `/${c.data.toJSON().name}`;
        }
        return `/${(c && c.data && c.data.name) || 'unknown'}`;
      } catch (e) { return '/unknown'; }
    });
    const list = cmds.map((c: string) => `• ${c}`).join('\n');
    await interaction.reply({ embeds: [makeEmbed(`Commands:\n${list}`)], ephemeral: true });
  } catch (e) {
    await interaction.reply({ embeds: [makeEmbed('No commands found.')], ephemeral: true });
  }
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
  const user = interaction.options.getUser('user', true);
  const rows = listTicketsForUser(interaction.guildId!, user.id);
  if (!rows.length) return interaction.editReply({ embeds: [makeEmbed('No tickets found.')] });
  const host = process.env.TRANSCRIPTS_HOST || process.env.HOSTNAME || 'localhost';
  const port = process.env.TRANSCRIPTS_PORT || process.env.PORT || process.env.BOT_API_PORT || '3000';
  const proto = process.env.TRANSCRIPTS_PROTOCOL || process.env.BOT_API_PROTOCOL || 'http';
  const base = `${proto}://${host}:${port}`;

  const list = rows.map((r: any) => {
    const filename = r.transcriptPath ? path.basename(r.transcriptPath) : null;
    const link = filename ? `${base}/transcripts/${encodeURIComponent(filename)}` : `#${r.id}`;
    return `[Ticket](${link}) - <#${r.channelId}> - ${r.status}`;
  }).join('\n');
  return interaction.editReply({ embeds: [makeEmbed(`Tickets:\n${list}`)] });
};
