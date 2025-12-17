import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('force-close')
    .setDescription('Force close a ticket by id')
    .addStringOption((o) => o.setName('ticketid').setDescription('Ticket ID to close').setRequired(true)),
  async execute(interaction: any, ctx: any) {
    return handlers.forceClose(interaction, ctx);
  }
};
