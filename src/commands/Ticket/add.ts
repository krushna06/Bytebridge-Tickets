import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a user to the ticket channel')
    .addUserOption((o) => o.setName('user').setDescription('User to add').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for adding').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.add(interaction, ctx);
  }
};
