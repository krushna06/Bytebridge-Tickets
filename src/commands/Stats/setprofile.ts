import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('setprofile')
    .setDescription('Set your staff profile')
    .addStringOption((o) => o.setName('name').setDescription('Display name').setRequired(false))
    .addStringOption((o) => o.setName('bio').setDescription('Short bio').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.setprofile(interaction, ctx);
  }
};
