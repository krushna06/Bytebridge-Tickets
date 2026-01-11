import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket')
    .addBooleanOption((o) => o.setName('save').setDescription('Save a transcript').setRequired(false))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for closing').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.close(interaction, ctx);
  }
};
