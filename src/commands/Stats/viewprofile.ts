import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('viewprofile')
    .setDescription('View a staff profile')
    .addUserOption((o) => o.setName('user').setDescription('User to view').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.viewprofile(interaction, ctx);
  }
};
