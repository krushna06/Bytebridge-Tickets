import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('List tickets')
    .addUserOption((o) => o.setName('user').setDescription('Show tickets for a user').setRequired(false))
    .addIntegerOption((o) => o.setName('limit').setDescription('Number of tickets to show').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.tickets(interaction, ctx);
  }
};
