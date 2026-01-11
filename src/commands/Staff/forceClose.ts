import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('force-close')
    .setDescription('Force close a ticket without confirmation')
    .addStringOption((o) => o.setName('ticketid').setDescription('Ticket ID to close').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for closing').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.forceClose(interaction, ctx);
  }
};
