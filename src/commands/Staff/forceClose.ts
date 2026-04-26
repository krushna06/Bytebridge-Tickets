import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('forceclose')
    .setDescription('Force close a ticket without requests')
    .addStringOption((o) =>
      o
        .setName('ticketid')
        .setDescription('Ticket ID to close (optional, uses current channel if not provided)')
        .setRequired(false)
    )
    .addStringOption((o) =>
      o
        .setName('reason')
        .setDescription('Reason for force closing the ticket')
        .setRequired(false)
    ),
  async execute(interaction: any, ctx: any) {
    return handlers.forceClose(interaction, ctx);
  }
};
