import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  category: 'Stats',
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show staff or server stats')
    .addUserOption((o) => o.setName('user').setDescription('User to show stats for').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.stats(interaction, ctx);
  }
};
