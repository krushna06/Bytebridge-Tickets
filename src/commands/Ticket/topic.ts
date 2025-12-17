import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('topic')
    .setDescription('Set the ticket topic/description')
    .addStringOption((o) => o.setName('topic').setDescription('Topic text').setRequired(true)),
  async execute(interaction: any, ctx: any) {
    return handlers.topic(interaction, ctx);
  }
};
