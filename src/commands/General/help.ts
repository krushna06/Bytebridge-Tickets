import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help for bot commands')
    .addStringOption((opt) =>
      opt.setName('command').setDescription('Specific command to show help for').setRequired(false)
    ),
  async execute(interaction: any, ctx: any) {
    return handlers.help(interaction, ctx);
  }
};
