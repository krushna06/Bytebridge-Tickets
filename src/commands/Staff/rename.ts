import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename the ticket channel')
    .addStringOption((o) => o.setName('name').setDescription('New channel name').setRequired(true)),
  async execute(interaction: any, ctx: any) {
    return handlers.rename(interaction, ctx);
  }
};
