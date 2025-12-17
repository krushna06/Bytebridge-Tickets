import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder().setName('release').setDescription('Release a claimed ticket'),
  async execute(interaction: any, ctx: any) {
    return handlers.release(interaction, ctx);
  }
};
