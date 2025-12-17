import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a user from the ticket channel')
    .addUserOption((o) => o.setName('user').setDescription('User to remove').setRequired(true)),
  async execute(interaction: any, ctx: any) {
    return handlers.remove(interaction, ctx);
  }
};
