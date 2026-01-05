import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';
import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings, upsertGuildSettings } from '../../lib/database';

export default {
  data: new SlashCommandBuilder()
    .setName('setstaff')
    .setDescription('Set guild staff roles (admins only).')
    .addRoleOption(o => o.setName('role1').setDescription('Role 1').setRequired(false))
    .addRoleOption(o => o.setName('role2').setDescription('Role 2').setRequired(false))
    .addRoleOption(o => o.setName('role3').setDescription('Role 3').setRequired(false))
    .addRoleOption(o => o.setName('role4').setDescription('Role 4').setRequired(false))
    .addRoleOption(o => o.setName('role5').setDescription('Role 5').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
    if (!member || !member.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ ephemeral: true, content: 'You need the Manage Server permission to run this.' });
    }

    const ids: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const r = interaction.options.getRole(`role${i}`, false);
      if (r && r.id) ids.push(r.id);
    }

    const settings = getGuildSettings(interaction.guildId);
    const newSettings = {
      guildId: interaction.guildId,
      staffRoleId: settings ? settings.staffRoleId : null,
      allowedRoles: ids.length ? JSON.stringify(ids) : null,
      categoryId: settings ? settings.categoryId : null,
      closedCategoryId: settings ? settings.closedCategoryId : null,
      claimEnabled: settings ? settings.claimEnabled : 1,
      transcriptEnabled: settings ? settings.transcriptEnabled : 1,
      transcriptChannelId: settings ? settings.transcriptChannelId : null,
      feedbackChannelId: settings ? settings.feedbackChannelId : null,
      closeTimeout: settings ? settings.closeTimeout : 0,
      embedColor: settings ? settings.embedColor : null,
      embedFooter: settings ? settings.embedFooter : null,
      ticketChannelId: settings ? settings.ticketChannelId : null,
      logsChannelId: settings ? settings.logsChannelId : null
    } as any;

    upsertGuildSettings(newSettings);
    return interaction.reply({ ephemeral: true, content: ids.length ? `Staff roles set to: ${ids.map(i => `<@&${i}>`).join(', ')}` : 'Staff roles cleared.' });
  }
};
