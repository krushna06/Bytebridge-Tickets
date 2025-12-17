import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('viewnotes')
    .setDescription('View notes for a user or ticket')
    .addUserOption((o) => o.setName('user').setDescription('User to view notes for').setRequired(false))
    .addIntegerOption((o) => o.setName('ticket').setDescription('Ticket id to view notes for').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.viewnotes(interaction, ctx);
  }
};
