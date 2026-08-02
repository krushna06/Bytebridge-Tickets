import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  category: 'Staff',
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a ticket channel to another category or channel')
    .addChannelOption((o) => o.setName('channel').setDescription('Destination channel').setRequired(true)),
  async execute(interaction: any, ctx: any) {
    return handlers.move(interaction, ctx);
  }
};
