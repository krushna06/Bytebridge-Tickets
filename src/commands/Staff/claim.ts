import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../handlers';

export default {
  data: new SlashCommandBuilder().setName('claim').setDescription('Claim the ticket for yourself'),
  async execute(interaction: any, ctx: any) {
    return handlers.claim(interaction, ctx);
  }
};
