import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getTag, listTicketsForUser } from '../lib/database';
import path from 'path';
import { Ctx, makeEmbed } from './common';
import commandsList from '../commands';
import { getTranscriptBaseUrl } from '../lib/urlHelper';

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
    await interaction.reply({ embeds: [makeEmbed(`Commands:\n${list}`, undefined, interaction.guildId || undefined)], flags: MessageFlags.Ephemeral });
  } catch (e) {
    await interaction.reply({ embeds: [makeEmbed('No commands found.', undefined, interaction.guildId || undefined)], flags: MessageFlags.Ephemeral });
  }
};

export const _new = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const reason = interaction.options.getString('title') || interaction.options.getString('reason') || undefined;
  const category = interaction.options.getChannel('category') as any;
  const opener = interaction.guild?.members.cache.get(interaction.user.id) ?? (interaction.member as any);
  const result = await ctx.ticketManager.createTicket(interaction.guild!, opener, reason, category && category.id ? category.id : undefined);
  await interaction.editReply({ embeds: [makeEmbed(`Ticket created: <#${result.channel.id}> (ID: ${result.ticketId})`, undefined, interaction.guildId || undefined)] });
};

export const tag = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const tagName = interaction.options.getString('name', true);
  const tag = getTag(interaction.guildId!, tagName) as any | null;
  if (!tag) return interaction.editReply({ embeds: [makeEmbed(`Tag '${tagName}' not found.`, undefined, interaction.guildId || undefined)] });
  return interaction.editReply({ embeds: [makeEmbed(tag.content, undefined, interaction.guildId || undefined)] });
};

export const tickets = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const user = interaction.options.getUser('user', true);
  const rows = listTicketsForUser(interaction.guildId!, user.id);
  if (!rows.length) return interaction.editReply({ embeds: [makeEmbed('No tickets found.', undefined, interaction.guildId || undefined)] });
  const base = getTranscriptBaseUrl();

  const list = rows.map((r: any) => {
    const filename = r.transcriptPath ? path.basename(r.transcriptPath) : null;
    const link = filename ? `${base}/transcripts/${encodeURIComponent(filename)}` : `#${r.id}`;
    return `[Ticket](${link}) - <#${r.channelId}> - ${r.status}`;
  }).join('\n');
  return interaction.editReply({ embeds: [makeEmbed(`Tickets:\n${list}`, undefined, interaction.guildId || undefined)] });
};
