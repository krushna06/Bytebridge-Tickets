import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show staff leaderboard')
    .addStringOption((o) => o
      .setName('sort')
      .setDescription('What to sort by')
      .setRequired(false)
      .addChoices(
        { name: 'Total Tickets Resolved', value: 'resolved' },
        { name: 'Avg Response Time', value: 'response' },
        { name: 'Avg Resolve Time', value: 'resolve' },
        { name: 'Avg Feedback Score', value: 'feedback' }
      )
    )
    .addIntegerOption((o) => o.setName('limit').setDescription('How many entries to show').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.leaderboard(interaction, ctx);
  }
};
