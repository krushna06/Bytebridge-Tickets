import { SlashCommandBuilder } from '@discordjs/builders';
import handlers from '../../handlers';

export default {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Add an internal note to a ticket or user')
    .addStringOption((o) => o.setName('text').setDescription('Note text').setRequired(true))
    .addUserOption((o) => o.setName('user').setDescription('User to attach note to').setRequired(false)),
  async execute(interaction: any, ctx: any) {
    return handlers.note(interaction, ctx);
  }
};
