import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show staff leaderboard')
    .addIntegerOption((o) => o.setName('limit').setDescription('How many entries to show').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.leaderboard(interaction, ctx);
  }
};
