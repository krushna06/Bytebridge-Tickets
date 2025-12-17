import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings, upsertGuildSettings } from '../../lib/database';

export default {
  data: new SlashCommandBuilder()
    .setName('settranscript')
    .setDescription('Set the channel where transcripts are posted.')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post transcripts to').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
    if (!member || !member.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ ephemeral: true, content: 'You need the Manage Server permission to run this.' });
    }

    const channel = interaction.options.getChannel('channel', true);
    if (!channel || !('isTextBased' in channel) || !(channel as any).isTextBased()) return interaction.reply({ ephemeral: true, content: 'Please select a text channel.' });

    const settings = getGuildSettings(interaction.guildId!);
    const newSettings = {
      guildId: interaction.guildId!,
      staffRoleId: settings ? settings.staffRoleId : null,
      allowedRoles: settings ? settings.allowedRoles : null,
      categoryId: settings ? settings.categoryId : null,
      closedCategoryId: settings ? settings.closedCategoryId : null,
      claimEnabled: settings ? settings.claimEnabled : 1,
      transcriptEnabled: settings ? settings.transcriptEnabled : 1,
      transcriptChannelId: channel.id,
      closeTimeout: settings ? settings.closeTimeout : 0
    } as any;

    upsertGuildSettings(newSettings);
    return interaction.reply({ ephemeral: true, content: `Transcript channel set to <#${channel.id}>` });
  }
};
