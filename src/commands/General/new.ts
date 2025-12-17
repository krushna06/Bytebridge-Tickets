import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('new')
    .setDescription('Open a new ticket')
    .addStringOption((o) =>
      o.setName('title').setDescription('Short title for the ticket').setRequired(false)
    )
    .addUserOption((o) => o.setName('user').setDescription('Create ticket for this user').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.new(interaction, ctx);
  }
};
