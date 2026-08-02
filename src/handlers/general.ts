import { ChatInputCommandInteraction, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { getTag, listTicketsForUser, getGuildSettings } from '../lib/database';
import path from 'path';
import { Ctx, makeEmbed } from './common';
import commandsList from '../commands';
import { getTranscriptBaseUrl } from '../lib/urlHelper';

export const help = async function (interaction: ChatInputCommandInteraction, ctx: Ctx) {
  try {
    const categories: { [key: string]: string[] } = {};
    
    (commandsList as any[]).forEach((c: any) => {
      try {
        const category = c.category || 'General';
        let commandName = '';
        
        if (c && c.data && typeof c.data.toJSON === 'function') {
          commandName = `\`/${c.data.toJSON().name}\``;
        } else if (c && c.data && c.data.name) {
          commandName = `\`/${c.data.name}\``;
        }
        
        if (commandName) {
          if (!categories[category]) {
            categories[category] = [];
          }
          categories[category].push(commandName);
        }
      } catch (e) {}
    });

    const categoryNames = Object.keys(categories);
    if (categoryNames.length === 0) {
      return await interaction.reply({ embeds: [makeEmbed('No commands found.', undefined, interaction.guildId || undefined)], flags: MessageFlags.Ephemeral });
    }

    let currentPage = 0;
    const totalPages = categoryNames.length + 1; // +1 for bot info page

    const formatUptime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours % 24 > 0) parts.push(`${hours % 24}h`);
      if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
      if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);
      
      return parts.join(' ') || '0s';
    };

    const generateEmbed = (page: number) => {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Information')
        .setColor('#5865F2')
        .setTimestamp()
        .setFooter({ 
          text: `Page ${page + 1}/${totalPages} • Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL({ size: 128 })
        });

      if (page === 0) {
        const uptime = ctx.client.uptime ? formatUptime(ctx.client.uptime) : 'Unknown';
        const guildCount = ctx.client.guilds.cache.size;
        const userCount = ctx.client.users.cache.size;
        const channelCount = ctx.client.channels.cache.size;
        const ping = ctx.client.ws.ping;
        
        embed.setDescription(`**${ctx.client.user?.tag}** - A ticket management bot`);
        embed.addFields(
          { name: '⏱️ Uptime', value: uptime, inline: true },
          { name: '🌐 Servers', value: `\`${guildCount}\``, inline: true },
          { name: '👥 Users', value: `\`${userCount}\``, inline: true },
          { name: '📺 Channels', value: `\`${channelCount}\``, inline: true },
          { name: '📡 Ping', value: `\`${ping}ms\``, inline: true },
          { name: '📚 Commands', value: `\`${(commandsList as any[]).length}\``, inline: true }
        );
        embed.setThumbnail(ctx.client.user?.displayAvatarURL({ size: 256 }) || null);
      } else {
        const categoryIndex = page - 1;
        const category = categoryNames[categoryIndex];
        const commands = categories[category];
        
        embed.setTitle('📚 Command Categories');
        embed.setDescription(`Use the buttons below to navigate through command categories.`);
        embed.addFields({
          name: `📁 ${category}`,
          value: commands.join('\n'),
          inline: false
        });
      }

      if (interaction.guildId) {
        const settings = getGuildSettings(interaction.guildId);
        if (settings?.embedColor) {
          const colorNum = parseInt(settings.embedColor.replace('#', ''), 16);
          embed.setColor(colorNum);
        }
      }

      return embed;
    };

    const generateButtons = (page: number) => {
      const row = new ActionRowBuilder<ButtonBuilder>();
      
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('help_prev')
          .setLabel('◀')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('help_next')
          .setLabel('▶')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );

      return row;
    };

    const message = await interaction.reply({ 
      embeds: [generateEmbed(currentPage)], 
      components: [generateButtons(currentPage)],
      flags: MessageFlags.Ephemeral 
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'These buttons are not for you!', flags: MessageFlags.Ephemeral });
      }

      if (i.customId === 'help_prev' && currentPage > 0) {
        currentPage--;
      } else if (i.customId === 'help_next' && currentPage < totalPages - 1) {
        currentPage++;
      }

      await i.update({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)]
      });
    });

    collector.on('end', () => {
      message.edit({ components: [] }).catch(() => {});
    });

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
