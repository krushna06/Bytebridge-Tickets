import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  category: 'Ticket',
  data: new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Get transcript for a ticket')
    .addStringOption((o) => o.setName('ticketid').setDescription('Ticket ID').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.transcript(interaction, ctx);
  }
};
